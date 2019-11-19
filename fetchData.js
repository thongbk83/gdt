var request = require("request");
const jsdom = require("jsdom");
const axios = require("axios");
const cities = require("./cities");
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

const limitRows = 100; //default 100;
var idTinh;
let rows;
let rowsData = [];
let cityName = "";
let urlObject = {
  cityName: "",
  districtName: "",
  wardName: "",
  url: ""
};

let urlsObject = [];

const fetchData = async id => {
  idTinh = id;
  rowsData = [];
  let cityObject = cities.find(city => city.id === id);
  cityName = cityObject ? cityObject.title : "";
  await getUrlsByCityId(id);
};

getUrlsByCityId = async cityId => {
  const resDistrict = await getDistricts(cityId);
  const districts = resDistrict.data;
  await sleep(3000);

  await getEntireXa(0, districts, cityId);
};

const getEntireXa = (index, districts, cityId) => {
  if (index >= districts.length) {
    console.log(urlsObject.length, 40);
    writeUrlToJsonFile(urlsObject, `${cityName}.json`);
    fetchEntireDataByUrls(0);
  } else {
    getWards(districts[index].id).then(res => {
      console.log(index, cityId);

      res.data.forEach(ward => {
        const url = `http://www.gdt.gov.vn/TTHKApp/jsp/results.jsp?maTinh=${cityId}&maHuyen=${districts[index].id}&maXa=${ward.id}&hoTen=&kyLb=01%2F2018&diaChi=&maSoThue=&searchType=11&uuid=9556e6b4-b766-44fc-82d8-87a26c70d9dc`;

        let urlObject = {
          cityName: cityName,
          districtName: districts[index].title,
          wardName: ward.title,
          url: url
        };
        urlsObject.push(urlObject);
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
  if (index >= urlsObject.length) {
    writeToExcel(rowsData, `${idTinh}.xlsx`);
    console.log("job done");
    process.exit();
  } else if (index % limitRows === 0 && index !== 0) {
    let n = index / limitRows;
    let name = `${idTinh}_part${n}.xlsx`;
    console.log("write file: ", name);
    writeToExcel(rowsData, name);
    rowsData = [];
    fetchEntireUsersByUrlObject(1, urlsObject[index], index);
  } else {
    console.log(65, urlsObject[index], index);
    fetchEntireUsersByUrlObject(1, urlsObject[index], index);
  }
};

const fetchEntireUsersByUrlObject = async (pageNo, urlObject, urlIndex) => {
  await sleep(5000);
  try {
    const actualUrl = urlObject.url + `&pageNumber=${pageNo}`;
    const html = await rp(actualUrl);
    rows = await parseData(html, urlObject);
    console.log("page: ", pageNo);
    if (!rows || [].concat(...rows).length === 0) {
      fetchEntireDataByUrls(urlIndex + 1);
    } else {
      rowsData = rowsData.concat(rows);
      fetchEntireUsersByUrlObject(pageNo + 1, urlObject, urlIndex);
    }
  } catch (error) {
    console.log(error);
    fetchEntireUsersByUrlObject(pageNo + 1, urlObject, urlIndex);
  }
};

function parseData(html, urlObject) {
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
            if (result && result.length > 0) {
              result = result.concat([
                urlObject.cityName,
                urlObject.districtName,
                urlObject.wardName
              ]);
            }

            rows.push(result);
          });
      });

    return resolve(rows);
  });
}

// function parseData(html) {
//   return new Promise(resolve => {
//     const { JSDOM } = jsdom;
//     const dom = new JSDOM(html);
//     const $ = require("jquery")(dom.window);
//     //let's start extracting the data
//     cols = [];
//     rows = [];
//     content = "";
//     if ($(html).find("table").length == 0) {
//       return resolve(false);
//     }

//     $(html)
//       .find("table")
//       .each(function(index, element) {
//         $(this)
//           .find("th")
//           .each(function(index, element) {
//             cols.push(
//               $(this)
//                 .text()
//                 .toLowerCase()
//             );
//           });
//       });

//     $(html)
//       .find("table")
//       .each(function(index, element) {
//         $(this)
//           .find("tr")
//           .each(function(index, element) {
//             result = [];
//             $(this)
//               .find("td")
//               .each(function(index) {
//                 result.push($(this).text());
//               });
//             rows.push(result);
//           });
//       });

//     return resolve(rows);
//   });
// }

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
