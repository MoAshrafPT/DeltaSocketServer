const axios = require("axios");
const io = require("socket.io")(3001, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

let operations = [];

io.on("connection", (socket) => {
  socket.on("get-document", async (documentId, userId) => {
    const document = await findOrCreateDocument(documentId, userId);
    console.log("got this document:", document);
    socket.join(documentId);
    socket.emit("load-document", document);

    socket.on("send-changes", (delta) => {
      socket.broadcast.to(documentId).emit("receive-changes", delta);
    });

    socket.on("save-document", async (data) => {
      console.log("I am being called");
      await findByIdAndUpdate(documentId,userId, { data });
    });
  });
});

async function findOrCreateDocument(fileId, userId) {
  if (fileId == null || userId == null) return null;
 
  const result = await axios.get(
    `http://localhost:8081/file/${fileId}/${userId}`
  );
  if (result.data) {
    console.log(result.data);
    return result.data.fileContent;
  }
}


async function findByIdAndUpdate(documentId,userId,{data}){
    if(documentId == null || userId == null || data == null) return null;
    console.log("my data is", data);
    const result = await axios.patch(`http://localhost:8081/file/saveEdits/${documentId}/${userId}`,{
        content: data
    })
    
    ;
    if(result.data){
      console.log(result.data);
        return result.data.fileContent;
    }
}

function operationalTransform(delta, currentOperation){
  //TODO: Implement Operational Transformation

}