const service = require("./reservations.service");
const asyncErrorBoundary = require("../errors/asyncErrorBoundary");
const { validStatus, FINISHED } = require("../constants");

// MIDDLEWARE
function timeDateValidation(req, res, next) {
  const { reservation_date, reservation_time } = req.body.data;
  const today = new Date();
  const resDateTimeString = `${reservation_date}T${reservation_time}`;
  const reqDate = new Date(resDateTimeString);
  const weekday =reqDate.getDay();
  console.log("today: ", today);
  console.log("request date: ", reqDate);
  console.log("weekday: ", weekday);
  console.log("today's week day: ", today.getDay());
  if (weekday === 2) {
    return next({
      status: 400,
      message:
        "This Restaurant is closed on Tuesdays, please choose a different day.",
    });
  }
  if (today.getTime() > reqDate.getTime()) {
    return next({
      status: 400,
      message: "This isn't a DeLorean, please select a date in the future.",
    });
  }
  if (reservation_time < "10:30" || reservation_time > "21:30") {
    return next({
      status: 400,
      message:
        "This Restaurant is open between 10:30AM & 9:30PM, please select a valid time.",
    });
  } else return next();
}

async function reservationExists(req, res, next) {
  const { reservation_id } = req.params;
  console.log(req.params);
  const reservations = await service.readReservation(reservation_id);
  if (reservations.length === 1) {
    res.locals.reservation = reservations[0];
    return next();
  }
  return next({
    status: 404,
    message: `No Reservation matches Reservation ID: ${reservation_id}.`,
  });
}

function reservationValidation(req, res, next) {
  const { data } = req.body;
  if (!data || data === "")
    return next({
      status: 400,
      message: "Reservation must include all fields",
    });
  const {
    first_name,
    last_name,
    mobile_number,
    reservation_date,
    reservation_time,
    people,
  } = data;

  if (!first_name || first_name === "")
    return next({ status: 400, message: "A 'first_name' must be included" });
  if (!last_name || last_name === "")
    return next({ status: 400, message: "A 'last_name' must be included" });
  if (!mobile_number || mobile_number === "")
    return next({ status: 400, message: "A 'mobile_number' must be included" });
  if (
    !reservation_date ||
    reservation_date === "" ||
    reservation_date === "not-a-date"
  )
    return next({
      status: 400,
      message: "A 'reservation_date' must be included",
    });
  if (
    !reservation_time ||
    reservation_time === "" ||
    reservation_time === "not-a-time"
  )
    return next({
      status: 400,
      message: "A 'reservation_time' must be included",
    });
  if (!people || people === "" || typeof people !== "number" || people < 1)
    return next({
      status: 400,
      message: "'people' error: Party Size must be a number greater than 0",
    });
  return next();
}

function statusIsBooked(req, res, next) {
  const { status } = req.body.data;
  if (!status || status === "booked") return next();
  else
    return next({
      status: 400,
      message:
        "status to create a reservation must be `booked`, cannot be `seated` or `finished`",
    });
}

function statusValidation(req, res, next) {
  const { status } = req.body.data;
  const validStatus = ["booked", "seated", "finished", "cancelled"];
  if (validStatus.includes(status)) return next();
  else
    return next({
      status: 400,
      message:
        "Status must be `booked`, `seated` or `finished` or `cancelled`, cannot be `unknown`",
    });
}

async function reservationNotFinished(req, res, next) {
  if (res.locals.reservation.status === "finished") {
    return next({
      status: 400,
      message: "a `finished` status cannot be updated",
    });
  }
  return next();
}

// CRUDL

async function list(req, res) {
  const { date, mobile_number } = req.query;
  if (date) {
    const data = await service.listByDate(date);
    res.json({ data });
  } else if (mobile_number) {
    const data = await service.listByPhone(mobile_number);
    res.json({ data });
  } else {
    const data = await service.list();
    res.json({ data });
  }
}

async function create(req, res) {
  const { data } = req.body;
  data.people = Number(data.people);
  const newReservation = await service.create(data);
  res.status(201).json({ data: newReservation });
}

async function readReservation(req, res) {
  const { reservation_id } = res.locals.reservation;
  const data = await service.readReservation(reservation_id);
  res.json({ data });
}

async function updateReservation(req, res) {
  const { reservation_id } = req.params;
  console.log(req);
  const updatedReservation = { ...req.body.data };
  const data = await service.update(updatedReservation, reservation_id);
  res.status(200).json({ data });
}

async function updateStatus(req, res) {
  let { reservation_id } = req.params;
  const { status } = req.body.data;
  reservation_id = Number(reservation_id);
  console.log("reservation_id: ", reservation_id);
  console.log("requested status: ", status);
  const data = await service.updateReservationStatus(status, reservation_id);
  res.status(200).json({ data });
}

module.exports = {
  list: asyncErrorBoundary(list),
  create: [
    reservationValidation,
    timeDateValidation,
    statusIsBooked,
    asyncErrorBoundary(create),
  ],
  read: [
    asyncErrorBoundary(reservationExists),
    asyncErrorBoundary(readReservation),
  ],
  update: [
    asyncErrorBoundary(reservationExists),
    timeDateValidation,
    reservationValidation,
    asyncErrorBoundary(updateReservation),
  ],
  updateStatus: [
    asyncErrorBoundary(reservationExists),
    statusValidation,
    reservationNotFinished,
    asyncErrorBoundary(updateStatus),
  ],
};
