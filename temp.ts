import bcrypt from "bcrypt";

const password = "123";
const saltRounds = 10;
const salt = await bcrypt.genSalt(saltRounds);
const hash = await bcrypt.hash(password, salt);

console.log(hash);
