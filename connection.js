import { MongoClient } from "mongodb";
import dotenv from "dotenv";

let db_connection;

dotenv.config();

const connectdb = (callback) =>{
   MongoClient.connect(process.env.ATLAS)
   .then((client)=>{
      db_connection = client.db(process.env.DATABASE);
      return callback();
   })
   .catch(err=>{
      console.error(err);
      return callback(err);
   })
};

const get_connection = () => db_connection;

export {connectdb, get_connection};