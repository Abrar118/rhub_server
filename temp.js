const datee = new Date("2023-10-11T15:14:44.195Z");
const today = new Date();

if(datee.getDate() < today.getDate()) console.log("Age");
else if(datee.getDate() === today.getDate()) console.log("Today");
else console.log("Pore");