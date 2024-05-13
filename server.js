const axios = require("axios");
//const { default: Quill } = require("quill");
//var quill = new Quill;
//const delta = Quill.import("delta");
const io = require("socket.io")(3001, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

let documentsOperations = new Map(); // {documentId: [operations]}
io.on("connection", (socket) => {
  socket.on("get-document", async (documentId, userId) => {
    const document = await findOrCreateDocument(documentId, userId);
    console.log("got this document:", document);
    socket.join(documentId);
    socket.emit("load-document", document);
    if (!documentsOperations.has(documentId)) {//if the document is not in the map create a new entry
      documentsOperations.set(documentId, []);
    }
    socket.on("send-changes", (delta, clientVersion, acknowledgeID) => {
      console.log("I am in send-changes");
      let operations = documentsOperations.get(documentId); //get the operations for the document
      console.log(operations, "operations");
      let serverVersion = operations.length;
      if(serverVersion !==0)
        delta = operationalTransform(delta, operations, clientVersion, serverVersion);
      operations.push(delta);
      let tempV = serverVersion + 1;
      console.log(tempV);
      socket.broadcast.to(documentId).emit("receive-changes",  delta, tempV, acknowledgeID ); // QUESTION: should we increment the server version before or after broadcasting the changes?
      socket.emit("acknowledge", acknowledgeID,tempV);
    });

    socket.on("save-document", async (data) => {
     // console.log("I am being called");
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
    //console.log(result.data);
    return result.data.fileContent;
  }
}


async function findByIdAndUpdate(documentId, userId, { data }) {
  if (documentId == null || userId == null || data == null) return null;
  //console.log("my data is", data);
  const result = await axios.patch(`http://localhost:8081/file/saveEdits/${documentId}/${userId}`, {
    content: data
  })

    ;
  if (result.data) {
   // console.log(result.data);
    return result.data.fileContent;
  }
}

function operationalTransform(delta, operations, clientVersion, serverVersion) {

  console.log("I am in operationalTransform", delta, operations, clientVersion, serverVersion);


  // if (!('retain' in delta.ops[0])) {
  //   delta.ops.unshift({ 'retain': 0 });
  // }
  if (clientVersion >= serverVersion) {
    return delta;
  }
  for (let i = clientVersion; i < serverVersion; i++) {
    console.log("I survived", i, "times");
    if ('insert' in delta.ops[1]) {
      if ('insert' in operations[i].ops[1]) {
        if (delta.ops[0].retain >= operations[i].ops[0].retain) {
          delta.ops[0].retain += operations[i].ops[1].length;
        }
      } else if ('delete' in operations[i].ops[1]) {
        if (delta.ops[0].retain >= operations[i].ops[0].retain) {
          delta.ops[0].retain -= operations[i].ops[1];
        }
      }
    } else if ('delete' in delta.ops[1]) {
      if ('insert' in operations[i].ops[1]) {
        if (delta.ops[0].retain >= operations[i].ops[0].retain) {
          delta.ops[0].retain += operations[i].ops[1].length;
        }
      } else if ('delete' in operations[i].ops[1]) {
        if (delta.ops[0].retain >= operations[i].ops[0].retain) {
          delta.ops[0].retain -= operations[i].ops[1];
        }
      }
    }
  }
  console.log("I am returning delta", delta);
  return delta;
}