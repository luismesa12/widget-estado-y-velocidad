const VAR_IDS = [
  "6273cbc21d84720356ab3c1e",//K3
  "6273cbbf1d84720356ab3c1d",//Bruckner
  "6273cbc41d8472053532193d",//K5
  "6273cbc01d847204ec1a1d52",//K4
  "6273cbbe1d8472040161f847",//Montfrt
];
const TK = "BBFF-WLsJWxy10qG3Db3mLFKRIittCrqCh8";

const ubidots = new Ubidots();
const chartReg = {};
let listenDateRange = false;
//options
////gauge options
const MAX = 150;
const BACKGROUND_COLOR = '#BFC1C1';
const BACKGROUND_OPACITY = 1;
const VALUE_COLOR = '#007EA7';
const SPEED_TEXT_COLOR = '#007EA7';
const GAUGE_WIDTH = 35;
const SPEED_FONT = {
  size: 2.5,
  paddingBottom: 20,
}
const UNIT_FONT = {
  size: 0.5,
  paddingTop: 15,
  text: 'xxxxxxxx xxxx'
}
const MIN_MAX_FONT = {
  size: 0.9,
}
//options//
const T_DISPONIBLE_MTTO = {
  label: 'test',
  context_total: 'total',
};
const GLOBAL_NAME = 'Global';

let var_ids_info = [];
let results = [];
let activeMachinesObj = {};

//---socket
const srv = "industrial.ubidots.com:443";
let socket;
const subscribedVars = [];
// Function to publish the variable ID
const subscribeVariable = function (variable, callback) {
  // Publishes the variable ID that wishes to listen
  socket.emit('rt/variables/id/last_value', {
      variable: variable
  });
  // Listens for changes
  socket.on('rt/variables/' + variable + '/last_value', callback);
  subscribedVars.push(variable);
};
// Function to unsubscribed for listening
const unSubscribeVariable = function (variable) {
  socket.emit('unsub/rt/variables/id/last_value', {
      variable: variable
  });
  const pst = subscribedVars.indexOf(variable);
  if (pst !== -1) {
      subscribedVars.splice(pst, 1);
  }
};
const connectSocket = function () {
  // Implements the socket connection
  socket.on('connect', function () {
      socket.emit('authentication', { token: TK });
  });
  window.addEventListener('online', function () {
      socket.emit('authentication', { token: TK });
  });
  socket.on('authenticated', function () {
      subscribedVars.forEach(function (variable_id) {
          socket.emit('rt/variables/id/last_value', { variable: variable_id });
      });
  });
}
const runSockets = () => {
  // Implements the connection to the server
  socket = io.connect("https://" + srv, { path: '/notifications' });

  /* Main Routine */

  connectSocket();
  // Should try to connect again if connection is lost
  socket.on('reconnect', connectSocket);
};
//---socket end//
//---services
const get_ServiceFetch_raw = async (variables, start, end, TK) => {
  let url = `https://industrial.api.ubidots.com/api/v1.6/data/raw/series`;
  const body = {
      variables,
      start,
      end,
      "join_dataframes": false,
      "columns": [
          "value.value",
          "timestamp",
          "device.name",
          "value.context",
      ]
  };
  return fetch(url, {
      method: "POST",
      headers: {
          "X-Auth-Token": TK,
          "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
  }).then(res => res.json())
      .catch(err => {
          console.log("ERROR:", err)
          return false;
      })
}
const get_vars_info = async (TK, varIds = [], fields = ['id', 'device']) => {
  const fieldsString = fields.join();
  const varIdsString = varIds.join();
  const url =
      `https://industrial.api.ubidots.com/api/v2.0/variables/?id__in=${varIdsString}&fields=${fieldsString}`
  return fetch(url, {
      method: "GET",
      headers: {
          "X-Auth-Token": TK,
          "Content-Type": "application/json"
      },
  }).then(res => res.json())
      .catch(err => {
          console.log("ERROR:", err);
      })
}
//---services//

//---chart
const drawGaugeChart = (data, container) => {
  // Check if the chart instance exists
  maybeDisposeChart(container);
  // Themes begin
  am4core.useTheme(am4themes_animated);
  // Themes end

  // create chart
  var chart = am4core.create(container, am4charts.GaugeChart);
  //Register chart for dispose
  chartReg[container] = chart;
  chart.padding(0, 0, 10, 10);
  chart.hiddenState.properties.opacity = 0; // this makes initial fade in effect
  chart.innerRadius = am4core.percent(100 - GAUGE_WIDTH);

  var axis = chart.xAxes.push(new am4charts.ValueAxis());
  axis.min = 0;
  axis.max = MAX;
  axis.strictMinMax = true;
  axis.renderer.grid.template.disabled = true;
  axis.renderer.labels.template.disabled = true;
  axis.renderer.labels.template.radius = 0;

  var colorSet = new am4core.ColorSet();

  var label = chart.radarContainer.createChild(am4core.Label);
  label.isMeasured = false;
  label.paddingBottom = SPEED_FONT.paddingBottom;
  label.fontSize = SPEED_FONT.size + 'rem';
  label.fontWeight = "bolder";
  //label.x = am4core.percent(50);
  label.horizontalCenter = "middle";
  label.verticalCenter = "middle";
  label.text = data.value;
  label.fill = am4core.color(SPEED_TEXT_COLOR);
  var unitsLabel = chart.radarContainer.createChild(am4core.Label);
  unitsLabel.isMeasured = false;
  unitsLabel.paddingTop = UNIT_FONT.paddingTop;
  unitsLabel.fontSize = UNIT_FONT.size + 'rem';
  unitsLabel.fontWeight = "bolder";
  //unitsLabel.x = am4core.percent(50);
  unitsLabel.horizontalCenter = "middle";
  unitsLabel.verticalCenter = "middle";
  unitsLabel.text = UNIT_FONT.text;
  unitsLabel.fill = am4core.color(SPEED_TEXT_COLOR);

  var range = axis.axisRanges.create();
  //range.value = 0;
  range.endValue = MAX;
  range.axisFill.fillOpacity = BACKGROUND_OPACITY;
  range.axisFill.fill = am4core.color(BACKGROUND_COLOR);
  range.axisFill.zIndex = -1;

  var range1 = axis.axisRanges.create();
  range1.value = 0;
  range1.endValue = data.value;
  range1.axisFill.fillOpacity = 1;
  range1.axisFill.fill = am4core.color(VALUE_COLOR);


  // Axis labels
  var label000 = chart.radarContainer.createChild(am4core.Label);
  //label000.isMeasured = false;
  label000.y = 2;
  label000.fontSize = MIN_MAX_FONT.size + 'rem';
  label000.horizontalCenter = "middle";
  label000.verticalCenter = "top";
  label000.text = "0";
  label000.adapter.add("x", function (x, target) {
      return -(axis.renderer.pixelInnerRadius + (axis.renderer.pixelRadius - axis.renderer.pixelInnerRadius) / 2);
  });

  var label100 = chart.radarContainer.createChild(am4core.Label);
  //label100.isMeasured = false;
  label100.y = 2;
  label100.fontSize = MIN_MAX_FONT.size + 'rem';
  label100.horizontalCenter = "middle";
  label100.verticalCenter = "top";
  label100.text = MAX;
  label100.adapter.add("x", function (x, target) {
      return (axis.renderer.pixelInnerRadius + (axis.renderer.pixelRadius - axis.renderer.pixelInnerRadius) / 2);
  });
}
const drawLinesChart = (data, series, axisTitle, container) => {
  // Check if the chart instance exists
  maybeDisposeChart(container);
  // Themes begin
  am4core.useTheme(am4themes_animated);
  // Themes end

  // Create chart instance
  var chart = am4core.create(container, am4charts.XYChart);
  //Register chart for dispose
  chartReg[container] = chart;
  chart.padding(11, 0, 0, 0);
  chart.colors.list = [
      am4core.color("#092331"),
      am4core.color("#007EA7"),
      am4core.color("#9A348E"),
      am4core.color("#DB504A"),
      am4core.color("#BFD7EA"),
      am4core.color("#09989B"),
      am4core.color("#E98A15"),
      am4core.color("#FFCA3A"),
      am4core.color("#9B9987"),
      am4core.color("#BCB6FF"),
  ];
  //number format
  chart.numberFormatter.numberFormat = "#.#%";
  // Add data
  chart.data = data

  // Create axes
  var dateAxis = chart.xAxes.push(new am4charts.DateAxis());
  dateAxis.renderer.minGridDistance = 40;
  //set axis interval 
  dateAxis.baseInterval = { count: 1, timeUnit: "month" };

  var valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
  //valueAxis.min = 0;
  valueAxis.max = 1;
  valueAxis.strictMinMax = true;
  //valueAxis.title.text = "% " + axisTitle;

  const createSeries = (seriesName, valueField, isActive = true) => {
      const series = chart.series.push(new am4charts.LineSeries());
      if (!isActive) series.hidden = true;
      series.dataFields.valueY = valueField;
      series.dataFields.dateX = "date";
      series.name = seriesName;
      series.tooltipText = `[bold]{name}:[/] {${valueField}}`;
      series.strokeWidth = 2;
      const bullet = series.bullets.push(new am4charts.CircleBullet());
      bullet.circle.strokeWidth = 2;
      bullet.circle.radius = 4;
      bullet.circle.fill = am4core.color("#fff");
      return series;
  }
  createSeries(GLOBAL_NAME, GLOBAL_NAME);
  series.forEach(({ name, active }) => {
      createSeries(name, name, active);
  });
  // Add cursor
  chart.cursor = new am4charts.XYCursor();
  chart.cursor.xAxis = dateAxis;
  // Add legend
  chart.legend = new am4charts.Legend();
  chart.legend.maxHeight = 80;
  chart.legend.scrollable = true;
  // Enable export
  chart.exporting.menu = new am4core.ExportMenu();
  chart.exporting.filePrefix = "Genial"
  //custom item( Enlarge ) 
  chart.exporting.menu.items = [{
      "label": "...",
      "menu": [
          { "type": "xlsx", "label": "XLSX" },
          { "type": "csv", "label": "CSV" },
          { "type": "pdfdata", "label": "PDF" },
      ]
  }];
  chart.legend.itemContainers.template.events.on("hit", function (ev) {
      const machineName = ev.target.dataItem.name;
      if (machineName === GLOBAL_NAME) return;
      const isActive = ev.target.isActive;
      activeMachinesObj[machineName] = isActive;
      const dataForGauge = prepareDataForGauge(results, activeMachinesObj);
      drawGaugeChart(dataForGauge, 'chartdiv');
  });
}
const removeEmptyItems = results => results.filter(e => e.length);

//---chart//
//---f
const toggleLoading = (isLoading) => {
  if (isLoading) {
      $('#widget').attr('hidden', true);
      $('#loading').attr("hidden", false);
      return
  }
  if (!isLoading) {
      $('#loading').attr("hidden", true);
      $('#widget').attr('hidden', false);
      return
  }
}
const prepareDataForLines = (results, activeMachinesObj) => {
  const GLOBAL_TOTAL_NAME = GLOBAL_NAME + '_total';
  const GLOBAL_AVA_NAME = GLOBAL_NAME + '_available';
  const machines = results.map(e => ({ name: e[0][2], active: activeMachinesObj[e[0][2]] }));
  const data = results.reduce((acc, curr) => {
      curr.forEach(e => {
          const item = {};
          const [value, timestamp, deviceName, contextString] = e;
          const context = JSON.parse(contextString);
          const total = context[T_DISPONIBLE_MTTO.context_total];
          const percent = total ? value / total : 0;
          const found = acc.find(e => e.date === timestamp);
          if (found) {
              found[deviceName] = percent;
              found[GLOBAL_AVA_NAME] += value;
              found[GLOBAL_TOTAL_NAME] += total;
              found[GLOBAL_NAME] = found[GLOBAL_TOTAL_NAME] ? found[GLOBAL_AVA_NAME] / found[GLOBAL_TOTAL_NAME] : 0;
              return
          };
          item['date'] = timestamp;
          item[deviceName] = percent;
          item[GLOBAL_AVA_NAME] = value;
          item[GLOBAL_TOTAL_NAME] = total;
          item[GLOBAL_NAME] = percent;
          acc.push(item);
      });
      return acc;
  }, []);
  data.sort((a, b) => a.date > b.date ? 1 : -1);
  machines.sort((a, b) => a.name > b.name ? 1 : -1);
  return { data, machines }
}
const prepareDataForGauge = (results, activeMachinesObj) => {
  let available_acum = 0;
  let total_acum = 0;
  results.forEach(e => {
      const firstDot = e[0];
      if (!firstDot) return;
      const [value, timestamp, device, contextString] = firstDot;
      const isActive = activeMachinesObj[device];
      if (!isActive) return;
      const currentMonth = new Date().getMonth()
      const dotMonth = new Date(timestamp).getMonth()
      const isCurrentMonth = currentMonth === dotMonth;
      if (!isCurrentMonth) return;
      const context = JSON.parse(contextString);
      const total = context[T_DISPONIBLE_MTTO.context_total];
      available_acum += value;
      total_acum += total;
  });
  const percent = total_acum ? (available_acum / total_acum) * 100 : 0;
  return { value: percent.toFixed(1) };
}
const dataAndDraw = (results, activeMachinesObj) => {
  const dataForLines = prepareDataForLines(results, activeMachinesObj);
  const dataForGauge = prepareDataForGauge(results, activeMachinesObj);
  drawGaugeChart(dataForGauge, 'chartdiv');
  drawLinesChart(dataForLines.data, dataForLines.machines, "", 'chartdiv2');
}
const resultsAndDraw = async (activeMachinesObj) => {
  const { start, end } = ubidots.dashboardDateRange;
  const res = await get_ServiceFetch_raw(VAR_IDS, start, end, TK);
  results = removeEmptyItems(res.results);
  dataAndDraw(results, activeMachinesObj);
}
const functionSubscribedVar = (dot, VAR_ID) => {
  const device = var_ids_info.find(e => e.id === VAR_ID).device.name;
  const parsedDot = JSON.parse(dot);
  const { value, timestamp, context, } = parsedDot;

  const foundResult = results.find(e => e[0][2] === device);
  if (!foundResult) {
      results.push([
          [value, timestamp, device, JSON.stringify(context)]
      ])
      dataAndDraw(results, activeMachinesObj);
      return
  }
  const mostRecentDotsTimestamp = foundResult[0][1];
  if (mostRecentDotsTimestamp === timestamp) {
      foundResult[0] = [value, timestamp, device, JSON.stringify(context)]
      dataAndDraw(results, activeMachinesObj);
      return
  }
  if (mostRecentDotsTimestamp <= timestamp) {
      foundResult.unshift([value, timestamp, device, JSON.stringify(context)])
      dataAndDraw(results, activeMachinesObj);
      return
  }
}
const maybeDisposeChart = chartdiv => {
  if (chartReg[chartdiv]) {
      chartReg[chartdiv].dispose();
      delete chartReg[chartdiv];
  }
}
//---f//
//---listen
ubidots.on('ready', async () => {
  toggleLoading(true);
  const resGet_vars_info = await get_vars_info(TK, VAR_IDS);
  var_ids_info = resGet_vars_info.results;
  activeMachinesObj = var_ids_info.reduce((acc, curr) => {
      acc[curr.device.name] = true;
      return acc;
  }, {})
  await resultsAndDraw(activeMachinesObj);
  runSockets();
  // Subscribe Variable.
  VAR_IDS.forEach((VAR_ID) => {
      subscribeVariable(VAR_ID, dot => functionSubscribedVar(dot, VAR_ID));
  })
  listenDateRange = true;
  toggleLoading(false);
})

ubidots.on('selectedDashboardDateRange', async function (data) {
  if (!listenDateRange) return;
  toggleLoading(true);
  await resultsAndDraw(activeMachinesObj);
  toggleLoading(false);
});