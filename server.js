const express = require("express");
const readline = require("readline");
const app = express();
const port = 3000;

const url =
  "https://www.gdt.gov.vn/TTHKApp/jsp/results.jsp?maTinh=805&maHuyen=80505&maXa=8050527&hoTen=&kyLb=01%2F2018&diaChi=&maSoThue=&searchType=11&uuid=9556e6b4-b766-44fc-82d8-87a26c70d9dc";

const fetchData = require("./fetchData");

app.get("/", (req, res) => res.send("Hello World!"));

app.listen(port, async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question("nhap ma~ ti~nh? ", answer => {
    // TODO: Log the answer in a database
    console.log(`bat dau lay data cua tinh~: ${answer}`);
    fetchData(answer);
  });
});
