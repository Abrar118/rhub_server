import * as qna from "@tensorflow-models/qna";
import * as fs from "fs";
import * as tf from "@tensorflow/tfjs";

let context: string;
let model: qna.QuestionAndAnswer;

tf.setBackend("cpu");

const loadModel = async () => {
  model = await qna.load();

  return model;
};

const getContext = () => {
  context = fs.readFileSync("./contextText.txt", "utf8");
  return context;
};

export { loadModel, getContext };
