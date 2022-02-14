var request = require("request");
const jsdom = require("jsdom");
const axios = require("axios");
const https = require('https');
const cities = require("./cities");
const rp = require("request-promise");
const fs = require("fs");
var cheerio = require("cheerio");



const agent = new https.Agent({  
  rejectUnauthorized: false
});

const options = { httpsAgent: agent }

const urlCity = "https://www.gdt.gov.vn/TTHKApp/jsp/json.jsp?cmd=GET_DS_TINH";
const urlDistrict =
  "https://www.gdt.gov.vn/TTHKApp/jsp/json.jsp?cmd=GET_DS_HUYEN&maTinh="; // ma tinh
const urlWard =
  "https://www.gdt.gov.vn/TTHKApp/jsp/json.jsp?cmd=GET_DS_XA&maCQThue="; //ma~ huyen

let Cookie = '; JSESSIONID=00009uPxnDKezeigNMtvsXtEndq:1a8b7lgns; TS01d2eb62=01dc12c85e4ced61277c64a27d2fcd6b0fbf4a4eac861d0de2a0a4a04d3b4cacbc6119d8e05cf73aa82e63f2fecff21157e77dda601f396479682305d4643143d362f3efd4ee1e3499508dabdc60fab4e654aa4309'

const headersNotCokkie = { 
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36', 
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9', 
};

let headers = { 
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36', 
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9', 
};

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

  // get cookie
  let cookieString = await getCookies()
  const dataString = cookieString.data.match(/"(.*?)"/)
  Cookie = dataString[1] + Cookie

  headers.Cookie = Cookie

  idTinh = id;
  rowsData = [];
  let cityObject = cities.find(city => city.id === id);
  cityName = cityObject ? cityObject.title : "";
  await getUrlsByCityId(id);
};



getUrlsByCityId = async cityId => {
   const resDistrict = await getDistricts(cityId);
   console.log(48, resDistrict);
  const districts = resDistrict.data;
  await sleep(3000);

  await getEntireXa(0, districts, cityId);
};

const getEntireXa = (index, districts, cityId) => {
  if (index >= districts.length) {
    console.log(56,urlsObject.length);
    writeUrlToJsonFile(urlsObject, `${cityName}.json`);
    fetchEntireDataByUrls(0);
  } else {
    getWards(districts[index].id).then(res => {
      console.log(61, index, cityId);

      res.data.forEach(ward => {
        const url = `https://www.gdt.gov.vn/TTHKApp/jsp/results.jsp?maTinh=${cityId}&maHuyen=${districts[index].id}&maXa=${ward.id}&hoTen=&kyLb=01%2F2018&diaChi=&maSoThue=&searchType=10&uuid=9556e6b4-b766-44fc-82d8-87a26c70d9dc`;

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
    const htmlData = await axios(configGetDataAxios(actualUrl));

    rows = await parseData(htmlData.data, urlObject);
    console.log(140,rows)
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
    //const $ = require("jquery")(dom.window);
    //let's start extracting the data

    const $1 = cheerio.load(html);
    const tables = $1("table");

    //console.log(130, $(html).find("table").length);
    cols = [];
    rows = [];
    content = "";

    //console.log(133, dom);
    if (tables.length == 0) {
      console.log(134);
      return resolve(false);
    }

    tables.each(function(index, element) {
      $1(this)
        .find("th")
        .each(function(index, element) {
          cols.push(
            $1(this)
              .text()
              .toLowerCase()
          );
        });
    });

    tables.each(function(index, element) {
      $1(this)
        .find("tr")
        .each(function(index, element) {
          result = [];
          $1(this)
            .find("td")
            .each(function(index) {
              result.push($1(this).text());
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
    console.log(179, rows.length);
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
  console.log(237);
  const XLSX = require("xlsx");
  var wb = XLSX.utils.book_new();
  var ws_name = "SheetJS";
  var ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, ws_name);
  XLSX.writeFile(wb, name);
  console.log(244);
}

const configGetCookieAxios = (cityId) => {
  return {
  method: 'get',
  url: `https://www.gdt.gov.vn/TTHKApp/jsp/json.jsp?cmd=GET_DS_HUYEN&maTinh=${cityId}`,
  headers: headersNotCokkie,
  httpsAgent: agent
}
}

const configGetDataAxios = actualUrl => {
  return {
  method: 'get',
  url: actualUrl,
  headers,
  httpsAgent: agent
}
}


const configGetDistrictsAxios = cityId => {
  return {
  method: 'get',
  url: `https://www.gdt.gov.vn/TTHKApp/jsp/json.jsp?cmd=GET_DS_HUYEN&maTinh=${cityId}`,
  headers,
  httpsAgent: agent
}
}

const configGetWardsAxios = districtId => {
  return {
  method: 'get',
  url: `https://www.gdt.gov.vn/TTHKApp/jsp/json.jsp?cmd=GET_DS_XA&maCQThue=${districtId}`,
  headers,
  httpsAgent: agent
}
}

const getCookies = () => {
  return axios(configGetCookieAxios(805));
};

const getDistricts = cityId => {
  return axios(configGetDistrictsAxios(cityId));
};

const getWards = districtId => {
  return axios(configGetWardsAxios(districtId))
};

module.exports = fetchData;
