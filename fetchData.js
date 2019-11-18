var request = require("request");
const jsdom = require("jsdom");
const axios = require("axios");
const rp = require("request-promise");
const fs = require("fs");

const options = {
  headers: { "content-type": "application/json charset=utf-8" }
};

const urlCity = "http://www.gdt.gov.vn/TTHKApp/jsp/json.jsp?cmd=GET_DS_TINH";
const urlDistrict =
  "http://www.gdt.gov.vn/TTHKApp/jsp/json.jsp?cmd=GET_DS_HUYEN&maTinh="; // ma tinh
const urlWard =
  "http://www.gdt.gov.vn/TTHKApp/jsp/json.jsp?cmd=GET_DS_XA&maCQThue="; //ma~ huyen

const limitRows = 100;
var idTinh;
let rows;
let urls;
let rowsData = [];
const fetchData = async id => {
  idTinh = id;
  urls = [];
  rowsData = [];
  await getUrlsByCityId(id);
};

getUrlsByCityId = async cityId => {
  let urls = [];
  const resDistrict = await getDistricts(cityId);
  const districts = resDistrict.data;
  await sleep(3000);

  await getEntireXa(0, districts, cityId);
};

const getEntireXa = (index, districts, cityId) => {
  if (index >= districts.length) {
    console.log(urls.length, 40);
    writeUrlToJsonFile(urls, `${cityId}.json`);
    fetchEntireDataByUrls(0);
  } else {
    getWards(districts[index].id).then(res => {
      console.log(index, cityId);
      res.data.forEach(ward => {
        const url = `http://www.gdt.gov.vn/TTHKApp/jsp/results.jsp?maTinh=${cityId}&maHuyen=${districts[index].id}&maXa=${ward.id}&hoTen=&kyLb=01%2F2018&diaChi=&maSoThue=&searchType=11&uuid=9556e6b4-b766-44fc-82d8-87a26c70d9dc`;
        urls.push(url);
      });
      sleep(2000).then(() => getEntireXa(index + 1, districts, cityId));
    });
  }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const writeUrlToJsonFile = (rows, name) => {
  fs.writeFile(name, JSON.stringify(rows), function(err) {
    if (err) {
      return console.log(err);
    }
    console.log("The file was saved!");
  });
};

const fetchEntireDataByUrls = index => {
  //urls.length
  if (index >= urls.length) {
    writeToExcel(rowsData, `${idTinh}.xlsx`);
    console.log("job done");
    process.exit();
  } else if (index % limitRows === 0 && index !== 0) {
    let n = index / limitRows;
    let name = `${idTinh}_part${n}.xlsx`;
    console.log("write file: ", name);
    writeToExcel(rowsData, name);
    rowsData = [];
    fetchEntireUsersByUrl(1, urls[index], index);
  } else {
    console.log(65, urls[index], index);
    fetchEntireUsersByUrl(1, urls[index], index);
  }
};

const fetchEntireUsersByUrl = async (pageNo, url, urlIndex) => {
  await sleep(5000);
  try {
    const actualUrl = url + `&pageNumber=${pageNo}`;
    const html = await rp(actualUrl);
    rows = await parseData(html);
    console.log(pageNo);
    if (!rows || [].concat(...rows).length === 0) {
      fetchEntireDataByUrls(urlIndex + 1);
    } else {
      rowsData = rowsData.concat(rows);
      fetchEntireUsersByUrl(pageNo + 1, url, urlIndex);
    }
  } catch (error) {
    console.log(error);
    fetchEntireUsersByUrl(pageNo + 1, url, urlIndex);
  }
};

function parseData(html) {
  return new Promise(resolve => {
    const { JSDOM } = jsdom;
    const dom = new JSDOM(html);
    const $ = require("jquery")(dom.window);
    //let's start extracting the data
    cols = [];
    rows = [];
    content = "";
    if ($(html).find("table").length == 0) {
      return resolve(false);
    }

    $(html)
      .find("table")
      .each(function(index, element) {
        $(this)
          .find("th")
          .each(function(index, element) {
            cols.push(
              $(this)
                .text()
                .toLowerCase()
            );
          });
      });

    $(html)
      .find("table")
      .each(function(index, element) {
        $(this)
          .find("tr")
          .each(function(index, element) {
            result = [];
            $(this)
              .find("td")
              .each(function(index) {
                result.push($(this).text());
              });
            rows.push(result);
          });
      });

    return resolve(rows);
  });
}

function writeToExcel(rows, name) {
  const XLSX = require("xlsx");
  var wb = XLSX.utils.book_new();
  var ws_name = "SheetJS";
  var ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, ws_name);
  XLSX.writeFile(wb, name);
  console.log(159);
}

const getDistricts = cityId => {
  return axios.get(
    `http://www.gdt.gov.vn/TTHKApp/jsp/json.jsp?cmd=GET_DS_HUYEN&maTinh=${cityId}`,
    options
  );
};

const getWards = districtId => {
  return axios.get(
    `http://www.gdt.gov.vn/TTHKApp/jsp/json.jsp?cmd=GET_DS_XA&maCQThue=${districtId}`,
    options
  );
};

module.exports = fetchData;
