const axios = require("axios");
const io = require("socket.io")(3001, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
const AsyncLock = require('async-lock');
const lock = new AsyncLock();

let serverVersion = 0;
let documentsOperations = new Map(); // {documentId: [operations]}

io.on("connection", (socket) => {
  socket.on("get-document", async (documentId, userId) => {
    const document = await findOrCreateDocument(documentId, userId);
    console.log("got this document:", document);
    socket.join(documentId);
    socket.emit("load-document", document, serverVersion);

    if (!documentsOperations.has(documentId)) {
      // If the document is not in the map, create a new entry
      documentsOperations.set(documentId, []);
    }

    socket.on("send-changes", async (delta, clientVersion, acknowledgeID) => {
      console.log("I am in send-changes");

      await lock.acquire(documentId, async () => {
        let operations = documentsOperations.get(documentId); // Get the operations for the document
        serverVersion = operations.length;

        if (serverVersion !== 0) {
          delta = operationalTransform(delta, operations, clientVersion, serverVersion);
        }

        let modifiedDelta = delta;
        if (modifiedDelta.ops[0] && !("retain" in modifiedDelta.ops[0])) {
          modifiedDelta.ops.unshift({ retain: 0 });
        }

        operations.push(modifiedDelta);
        let tempV = serverVersion + 1;

        if (delta.ops[0] && delta.ops[0].retain == 0) {
          delta.ops = [delta.ops[1]];
        }

        console.log(tempV, delta);
        socket.broadcast
          .to(documentId)
          .emit("receive-changes", delta, tempV, acknowledgeID); // Broadcast changes

        socket.emit("acknowledge", acknowledgeID, tempV);
      });
    });

    socket.on("cursor-change", (cursor) => {
      //console.log("Cursor change event received:", cursor);
      // Broadcast the cursor change to all other clients except the sender
      socket.broadcast.emit("cursor-change", cursor);
    });

    socket.on("save-document", async (data) => {
      await findByIdAndUpdate(documentId, userId, { data });
    });
  });
});

async function findOrCreateDocument(fileId, userId) {
  if (fileId == null || userId == null) return null;

  const result = await axios.get(
    `http://localhost:8081/file/${fileId}/${userId}`
  );
  if (result.data) {
    return result.data.fileContent;
  }
}

async function findByIdAndUpdate(documentId, userId, { data }) {
  if (documentId == null || userId == null || data == null) return null;

  const result = await axios.patch(
    `http://localhost:8081/file/saveEdits/${documentId}/${userId}`,
    {
      content: data,
    }
  );

  if (result.data) {
    return result.data.fileContent;
  }
}

function operationalTransform(delta, operations, clientVersion, serverVersion) {
  console.log(
    "I am in operationalTransform",
    delta,
    clientVersion,
    serverVersion
  );

  if (delta.ops[0] && !("retain" in delta.ops[0])) {
    delta.ops.unshift({ retain: 0 });
    console.log("Unshifting delta:", delta);
  }

  if (clientVersion >= serverVersion) {
    if (delta.ops[0] && delta.ops[0].retain == 0) {
      delta.ops = [delta.ops[1]];
    }
    console.log("I am returning delta", delta);
    return delta;
  }

  for (let i = clientVersion; i < serverVersion; i++) {
    if (operations[i].ops[0] && !("retain" in operations[i].ops[0])) {
      operations[i].ops.unshift({ retain: 0 });
    }

    console.log("I survived", i, "times");
    console.log(delta.ops, "delta.ops");
    console.log(operations[i], "operations[i]");

    if ("insert" in delta.ops[1]) {
      if ("insert" in operations[i].ops[1]) {
        if (delta.ops[0].retain >= operations[i].ops[0].retain) {
          console.log("I am insert insert", i);
          delta.ops[0].retain += operations[i].ops[1].insert.length - 1;
        }
      } else if ("delete" in operations[i].ops[1]) {
        if (delta.ops[0].retain >= operations[i].ops[0].retain) {
          delta.ops[0].retain -= operations[i].ops[1].delete;
          console.log("I am insert delete");
        }
      }
    } else if ("delete" in delta.ops[1]) {
      if ("insert" in operations[i].ops[1]) {
        if (delta.ops[0].retain >= operations[i].ops[0].retain) {
          delta.ops[0].retain += operations[i].ops[1].insert.length - 1;
          console.log("I am delete insert");
        }
      } else if ("delete" in operations[i].ops[1]) {
        if (delta.ops[0].retain >= operations[i].ops[0].retain) {
          delta.ops[0].retain -= operations[i].ops[1].delete;
          console.log("I am delete delete");
        }
      }
    }
  }

  if (delta.ops[0] && delta.ops[0].retain == 0) {
    delta.ops = [delta.ops[1]];
  }

  console.log("I am returning delta", delta);
  return delta;
}