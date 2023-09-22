//if static dashboard
const IS_STATIC = true;
const MACHINE_NAME = "Maquina 1 D";
const DEVICE_ID = "600725cf0ff4c3259dcd5c39";
const DEVICE_LABEL = "3f002b001947393035313138";


// Normally it is not necessary to change this
const ON_OFF_VAR_LABEL = "on_off";
const SPEED_VAR_LABEL = "rate";
const FIRST_WARNING = 600000; // Status changes to orange after x milliseconds
const SECOND_WARNING = 1200000; // Status changes to red after x milliseconds

/* Vars */
const ubidots = new Ubidots();
let varIdsObj = {};
let shift = {
  endInMinutes: null,
  mtto: false,
};
let intervalId;
//ignore
const HAS_BOTIN = false;
const BOTIN_VAR_LABEL = "botin";
const ADJUST_TEXT = "En Ajustes";

/* SOCKET */
const srv = window.location.hostname + ":443";
let socket;
const subscribedVars = [];
// Function to publish the variable ID
const subscribeVariable = function (variable, callback) {
  // Publishes the variable ID that wishes to listen
  socket.emit("rt/variables/id/last_value", {
    variable: variable,
  });
  // Listens for changes
  socket.on("rt/variables/" + variable + "/last_value", callback);
  subscribedVars.push(variable);
};
// Function to unsubscribed for listening
const unSubscribeVariable = function (variable) {
  socket.emit("unsub/rt/variables/id/last_value", {
    variable: variable,
  });
  const pst = subscribedVars.indexOf(variable);
  if (pst !== -1) {
    subscribedVars.splice(pst, 1);
  }
};
const connectSocket = function () {
  // Implements the socket connection
  socket.on("connect", function () {
    socket.emit("authentication", { token: ubidots.token });
  });
  window.addEventListener("online", function () {
    socket.emit("authentication", { token: ubidots.token });
  });
  socket.on("authenticated", function () {
    subscribedVars.forEach(function (variable_id) {
      socket.emit("rt/variables/id/last_value", { variable: variable_id });
    });
  });
};
const runSockets = () => {
  // Implements the connection to the server
  socket = io.connect("https://" + srv, { path: "/notifications" });

  /* Main Routine */

  connectSocket();
  // Should try to connect again if connection is lost
  socket.on("reconnect", connectSocket);
};
/* SOCKET END */

/* Services */
const getDataVarsIdByDeviceId = async (deviceId, varLabels = [], TK) => {
  let url = "https://industrial.ubidots.com/api/v2.0/variables/?fields=id,label,unit";
  url += "&label__in=" + varLabels.join();
  url += "&device__id__in=" + deviceId;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Auth-Token": TK,
      "Content-Type": "application/json",
    },
  }).then((res) => res.json());
  const data = {};
  res.results.forEach((e) => {
    data[e.label] = e.id;
    data[e.label + "_unit"] = e.unit;
  });
  return data;
};
const fetchLastDotByVarId = async (varId, to_k) => {
  const url = `https://industrial.api.ubidots.com/api/v1.6/variables/${varId}/values/?page_size=1`;
  return fetch(url, {
    method: "GET",
    headers: {
      "X-Auth-Token": to_k,
      "Content-Type": "application/json",
    },
  })
    .then((res) => res.json())
    .catch((err) => console.log(err));
};
async function get_org_id(token) {
  let id = "";
  let name = "";
  await $.ajax({
    url: "https://industrial.api.ubidots.com/api/v2.0/devices/?sort_by=created_at&fields=organization&page_size=1",
    headers: { "X-Auth-Token": token },
    contentType: "application/json; charset=utf-8",
    success: function (result) {
      for (let i = 0; i < result.results.length; i++) {
        let device_org = result.results[i].organization;
        if (device_org) {
          id = device_org.id;
          name = device_org.name;
          break;
        }
      }
    },
    error: function (error) {
      console.log("Error:", error);
    },
  });
  return { id, name };
}
/* Services end*/

/* Functions */
const query = async (varId, to_k) => {
  const res = await fetchLastDotByVarId(varId, to_k);
  functionSubscribedVar(res);
};

const getDateString = (d) => {
  const datestring =
    // ("0" + d.getDate()).slice(-2) +
    // "/" +
    // ("0" + (d.getMonth() + 1)).slice(-2) +
    // "/" +
    // d.getFullYear() +
    // " " +
    ("0" + d.getHours()).slice(-2) +
    ":" +
    ("0" + d.getMinutes()).slice(-2);
  return datestring;
};
const changeMachineTitle = (machineName) => {
  $("#machine-title").text(machineName);
};
const changeDateString = (timestamp) => {
  $("#value").html(getDateString(new Date(timestamp)));
};
const changeButtonState = (text, color) => {
  $(".icon-div").css("background-color", color);
  $("#status").text(text);
};
//validate time difference
const validateTimeDifference = (timestamp) => {
  const currentTime = Date.now();
  const dif = currentTime - timestamp;
  if (dif >= SECOND_WARNING) return changeButtonState("OFF >20", "#cb3234");
  if (dif >= FIRST_WARNING) return changeButtonState("OFF 10-20", "#e98a14");
  changeButtonState("OFF <10", "#bfc1c0");
};

const getTimeUntilEndOfShift = (shift) => {
  if (!shift.endInMinutes) return;
  const endInMinutes = shift.endInMinutes;
  const nowInMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  if (endInMinutes < nowInMinutes) {
    const A_DAY_IN_MINUTES = 24 * 60;
    const timeUntilEndOfShiftInMilliseconds = (A_DAY_IN_MINUTES - nowInMinutes + endInMinutes) * 60 * 1000;
    return timeUntilEndOfShiftInMilliseconds;
  }
  const timeUntilEndOfShiftInMilliseconds = (endInMinutes - nowInMinutes) * 60 * 1000;
  return timeUntilEndOfShiftInMilliseconds;
};
const getCurrentTotalMinutesSinceMidnight = () => {
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();
  const currentHourInMinutes = currentHour * 60;
  const currentTotalMinutesSinceMidnight = currentHourInMinutes + currentMinute;
  return currentTotalMinutesSinceMidnight;
};

const getIsShift = (shift, currentTotalMinutesSinceMidnight) => {
  if (!shift || !shift?.active) return false;
  const A_DAY_IN_MINUTES = 24 * 60;
  const shiftStart = shift.start_h * 60 + shift.start_m;
  const shiftEnd = shift.end_h * 60 + shift.end_m;
  if (shiftEnd > shiftStart) {
    const isShift = currentTotalMinutesSinceMidnight >= shiftStart && currentTotalMinutesSinceMidnight < shiftEnd;
    return isShift;
  }
  const isShift =
    (currentTotalMinutesSinceMidnight >= shiftStart && currentTotalMinutesSinceMidnight < A_DAY_IN_MINUTES) ||
    (currentTotalMinutesSinceMidnight >= 0 && currentTotalMinutesSinceMidnight < shiftEnd);
  return isShift;
};

const getNumberOfCurrentShift = (day_shifts, currentTotalMinutesSinceMidnight) => {
  const numberOfCurrentShift = Object.keys(day_shifts).find((ShiftNumber) => {
    return getIsShift(day_shifts[ShiftNumber], currentTotalMinutesSinceMidnight);
  });
  return numberOfCurrentShift;
};

const getCurrentShiftObject = (currentTotalMinutesSinceMidnight, day_shifts = {}) => {
  const numberOfCurrentShift = getNumberOfCurrentShift(day_shifts, currentTotalMinutesSinceMidnight);
  if (!numberOfCurrentShift) return { mtto: false, endInMinutes: null };
  const mtto = !!day_shifts[numberOfCurrentShift].mtto;
  const endInMinutes = day_shifts[numberOfCurrentShift].end_h * 60 + day_shifts[numberOfCurrentShift].end_m;
  return { mtto, endInMinutes };
};
const getCurrentShiftFromMongo = async (customer_id, machine_label) => {
  const defaultShift = {
    endInMinutes: null,
    mtto: false,
  };
  const res = await fetch(
    `https://us-east-1.aws.data.mongodb-api.com/app/application-0-ltupo/endpoint/get_current_shift_by_machine?customer_id=${customer_id}&machine_label=${machine_label}&timestamp=${Date.now()}`
  )
    .then((response) => response.json())
    .then((result) => JSON.parse(result))
    .catch((error) => {
      console.log("error", error);
    });
  if (!res) return defaultShift;
  const shift = res[0];
  if (!shift || !shift.day_shifts) return defaultShift;
  const dayShifts = shift.day_shifts;
  return getCurrentShiftObject(getCurrentTotalMinutesSinceMidnight(), dayShifts);
};
const getIsPlannedMtto = async () => {
  if (shift.endInMinutes) return shift.mtto;
  const machineLabel = IS_STATIC ? DEVICE_LABEL : ubidots.selectedDeviceObject?.label;
  const { id: customerId } = await get_org_id(ubidots.token);
  if (!machineLabel || !customerId) return;
  shift = await getCurrentShiftFromMongo(customerId, machineLabel);
  if (!shift) return false;
  const timeUntilEndOfShiftInMilliseconds = getTimeUntilEndOfShift(shift);
  if (!timeUntilEndOfShiftInMilliseconds) return shift.mtto;
  setTimeout(() => {
    shift = { endInMinutes: null, mtto: false };
    query(varIdsObj[ON_OFF_VAR_LABEL], ubidots.token);
  }, timeUntilEndOfShiftInMilliseconds);
  return shift.mtto;
};
const clearIntervalOfValidateTimeDifference = () => {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
};
const functionSubscribedVar = async (res) => {
  clearIntervalOfValidateTimeDifference();
  const botinRes = HAS_BOTIN && (await fetchLastDotByVarId(varIdsObj[BOTIN_VAR_LABEL], ubidots.token));
  const botin = botinRes && botinRes?.results[0]?.value;
  const value = res.results[0].value;
  const timestamp = res.results[0].timestamp;
  const is_mtto = res.results[0].context?.mtto;
  changeDateString(timestamp);
  const is_adjust = res.results[0].context?.adjust;
  if (is_adjust) return changeButtonState("En Ajustes", "#9BA2FF");
  if (is_mtto) return changeButtonState("En Mtto", "#05516C");
  if (value && HAS_BOTIN && !botin) return changeButtonState("Sin tela", "#dcdc00");
  if (value && HAS_BOTIN && botin === 1) return changeButtonState("OFF", "#bfc1c0");
  if (value || botin === 2) return changeButtonState("On", "#008f38");
  const isPlannedMtto = await getIsPlannedMtto();
  if (isPlannedMtto) return changeButtonState("En Mtto", "#05516C");
  //validateTimeDifference(timestamp);
  if (!intervalId) {
    intervalId = setInterval(() => {
      validateTimeDifference(timestamp);
    }, 1000);
  }
};
const determineMachineState = (onOffVarId, tk) => {
  query(onOffVarId, tk);
  subscribeVariable(onOffVarId, (dot) =>
    functionSubscribedVar({
      results: [JSON.parse(dot)],
    })
  );
};
const functionSubscribedVar_Speed = (dot) => {
  const { value } = dot;
  const speed = Number(value) ? Math.round(value) : 0;

  console.log('speed:',speed);
}
const determineCurrSpeed = async (speedVarId, tk) => {
  const res = await fetchLastDotByVarId(speedVarId, tk);
  functionSubscribedVar_Speed(res?.results?.[0] || {});
  subscribeVariable(speedVarId, (dot) =>
    functionSubscribedVar_Speed(JSON.parse(dot))
  );
};
/* Functions end*/

/* Listen */
let currentDeviceId = null; //fix ubidots event bug
ubidots.on("selectedDeviceObject", async function (selectedDeviceObject) {
  if (IS_STATIC || !ubidots.token) return;
  if (currentDeviceId === selectedDeviceObject.id) return; //fix ubidots event bug
  currentDeviceId = selectedDeviceObject.id; //fix ubidots event bug
  $("#status").empty();
  $("#value").empty();
  clearIntervalOfValidateTimeDifference();
  $(".icon-div").css("background-color", "#bfc1c0");
  shift = { endInMinutes: null, mtto: false };
  unSubscribeVariable(varIdsObj[ON_OFF_VAR_LABEL]);
  unSubscribeVariable(varIdsObj[SPEED_VAR_LABEL]);

  varIdsObj = await getDataVarsIdByDeviceId(selectedDeviceObject.id, [ON_OFF_VAR_LABEL, BOTIN_VAR_LABEL, SPEED_VAR_LABEL], ubidots.token);
  changeMachineTitle(selectedDeviceObject.name || "");
  determineMachineState(varIdsObj[ON_OFF_VAR_LABEL], ubidots.token);
  determineCurrSpeed(varIdsObj[SPEED_VAR_LABEL], ubidots.token);
});

ubidots.on("ready", async () => {
  console.log({ubidots});
  changeMachineTitle(IS_STATIC ? MACHINE_NAME : ubidots.deviceObject?.name);
  const selectedDeviceId = IS_STATIC ? DEVICE_ID : ubidots.selectedDevice;
  varIdsObj = await getDataVarsIdByDeviceId(selectedDeviceId, [ON_OFF_VAR_LABEL, BOTIN_VAR_LABEL, SPEED_VAR_LABEL], ubidots.token);
  runSockets();
  determineMachineState(varIdsObj[ON_OFF_VAR_LABEL], ubidots.token);
  determineCurrSpeed(varIdsObj[SPEED_VAR_LABEL], ubidots.token);
});
/*  */
