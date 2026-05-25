const { io } = require("socket.io-client");

const socket = io("https://smartcorrect-backend.onrender.com");

socket.on("connect", () => {
  console.log("Connected to backend!");
  
  socket.emit("analyze_text", { text: "im doing wll", mode: "grammar" });
  socket.emit("analyze_document", { text: "im doing wll" });
});

socket.on("ai_suggestion", (sugg) => {
  console.log("Received ai_suggestion:", sugg);
});

socket.on("document_metrics", (metrics) => {
  console.log("Received document_metrics:", metrics);
});

socket.on("disconnect", () => {
  console.log("Disconnected!");
});

setTimeout(() => {
  console.log("Timeout waiting for response");
  process.exit(0);
}, 10000);
