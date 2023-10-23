import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  UploadApiOptions,
  UploadApiResponse,
  v2 as cloudinary,
} from "cloudinary";
import { Db, MongoClient, Sort } from "mongodb";
import {
  Communities,
  User,
  Com_events,
  Comment,
  Upload_Log,
} from "./Models.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));
dotenv.config();

const ATLAS = process.env.ATLAS as string;
const DATABASE = process.env.DATABASE as string;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
  secure: true,
});

const cloudinaryOption: UploadApiOptions = {
  overwrite: true,
  invalidate: true,
  resource_type: "auto",
};

const response = await MongoClient.connect(ATLAS).catch((err) => {
  console.error(err);
});

let db: Db = response?.db(DATABASE) as Db;
app.listen(process.env.PORT, () => {
  console.log("Server listening to port " + process.env.PORT);
});

//students API

app.get("/get_students", (req, res) => {
  let users: unknown[] = [];
  db.collection("users")
    .find()
    .sort({ student_id: 1 })
    .forEach((user) => {
      users.push(user);
    })
    .then(() => {
      res.status(200).json(users);
    })
    .catch(() => res.status(500).json("Could not fetch data"));
});

app.get("/get_students/:id", (req, res) => {
  const std_id = Number(req.params.id);

  db.collection("users")
    .findOne({ student_id: std_id })
    .then((data) => {
      // console.log(data)
      res.status(200).json(data);
    })
    .catch((error) => {
      res.status(500).json("Could not fetch data");
    });
});

app.get("/getStudentByEmail/:email/:password", async (req, res) => {
  const email = req.params.email;
  const password = req.params.password;

  const user = db.collection<User>("users");

  user
    .findOne({ email: email })
    .then((data) => {
      if (data?.password === password) {
        if (data.authenticated === 1) res.status(200).json(data);
        else res.status(202).json({ authenticated: 0 });
      } else res.status(201).json({ student_id: "-1" });
    })
    .catch((error) => {
      res.status(500).json({ error: "Account not found!" });
    });
});

app.get("/getAuthStatus/:email", (req, res) => {
  const email = req.params.email;

  db.collection("users")
    .findOne({ email: email }, { projection: { authenticated: 1, _id: 0 } })
    .then((data) => {
      res.status(200).json(data);
    })
    .catch((error) => {
      res.status(500).json({ error: "Account not found!" });
    });
});

app.patch("/setAuthStatus", (req, res) => {
  const email = req.body.email;

  db.collection("users")
    .updateOne({ email: email }, { $set: { authenticated: 1 } })
    .then((data) => {
      res.status(200).json(data);
    })
    .catch((error) => {
      res.status(500).json({ error: "Account not found!" });
    });
});

app.post("/insertUser", (req, res) => {
  const user = req.body;

  db.collection("users")
    .insertOne(user)
    .then((result) => {
      res.status(200).json(result);
    })
    .catch((err) => {
      res.status(500).json({ err: "Duplicate Student ID" });
    });
});

app.patch("/updateUser/:studentId", (req, res) => {
  const user = req.body;
  const id = Number(req.params.studentId);

  db.collection("users")
    .updateOne({ student_id: id }, { $set: user })
    .then((result) => {
      res.status(200).json(result);
    })
    .catch((err) => {
      res.status(500).json({ err: "Could not create user" });
    });
});

app.patch("/addComToUser", (req, res) => {
  const user = req.body.userId;
  const tag = req.body.tag;

  db.collection("users")
    .updateOne({ student_id: user }, { $push: { community: tag } })
    .then((result) => {
      res.status(200).json(result);
    })
    .catch((err) => {
      res.status(500).json({ err: "Could not add community." });
    });
});

app.post("/uploadAvatar", async (req, res) => {
  const filePath = req.body.image;
  // console.log(filePath);

  const result = await cloudinary.uploader
    .upload(filePath, cloudinaryOption)
    .catch((err) => {
      res.status(500).json({ error: err.message });
    });

  res.status(200).json(result);
});

//community API

app.get("/get_top_communities", (req, res) => {
  let communities: unknown[] = [];

  db.collection("communities")
    .find()
    .sort({ rating: -1 })
    .limit(3)
    .forEach((community) => {
      communities.push(community);
    })
    .then(() => {
      res.status(200).json(communities);
    })
    .catch(() => res.status(500).json("Could not fetch data"));
});

app.get("/get_all_communities/:sort/:asc/:page", async (req, res) => {
  let communities: unknown[] = [];
  const criteria = req.params.sort;
  const asc = Number(req.params.asc) === 1 ? 1 : -1;
  const page = Number(req.params.page);
  const comPerPage = Number(8);
  let sort: any = {};

  if (criteria === "name") sort["name"] = asc;
  else if (criteria === "rating") sort["rating"] = asc;
  else if (criteria === "members") sort["members"] = asc;
  else sort.resource = asc;

  let find: { privacy: string; tag?: Object } = {
    privacy: "open",
  };

  const tag = req.query.tag as string;

  if (tag) find.tag = { $regex: `.*${tag}.*` };

  const data = db.collection<Communities>("communities");
  const numberOfCom = await data.estimatedDocumentCount();

  data
    .find(find)
    .skip(comPerPage * page)
    .limit(comPerPage)
    .sort(sort)
    .forEach((community) => {
      communities.push(community);
    })
    .then(() => {
      communities.push({ total: numberOfCom });
      res.status(200).json(communities);
    })
    .catch(() => res.status(500).json("Could not fetch data"));
});

app.get("/get_my_communities/:sort/:asc/:myTags/:page", async (req, res) => {
  let communities: unknown[] = [];
  const criteria = req.params.sort;
  const asc = Number(req.params.asc);
  const myComTags = JSON.parse(req.params.myTags);
  const page = Number(req.params.page);
  const comPerPage = Number(3);
  const sort: any = {};
  sort[criteria] = asc || 1;
  const find: { $and: Object[] } = {
    $and: [
      {
        tag: { $in: myComTags },
      },
    ],
  };

  const tag = req.query.tag as string;

  if (tag) find.$and.push({ tag: { $regex: `.*${tag}.*` } });

  const data = db.collection<Communities>("communities");
  const numberOfCom = await data.countDocuments(find);
  data
    .find(find)
    .skip(comPerPage * page)
    .limit(3)
    .sort(sort)
    .forEach((community) => {
      communities.push(community);
    })
    .then(() => {
      communities.push({ total: numberOfCom });
      res.status(200).json(communities);
    })
    .catch((error) => res.status(500).json({ message: error.message }));
});

app.get("/get_communityByTag/:tag", (req, res) => {
  const com_tag = req.params.tag;

  db.collection("communities")
    .findOne({ tag: com_tag })
    .then((data) => {
      res.status(200).json(data);
    })
    .catch((error) => {
      res.status(500).json("Could not fetch data");
    });
});

app.post("/insertCommunity", (req, res) => {
  const community = req.body;
  db.collection("communities")
    .insertOne(community)
    .then((result) => {
      res.status(200).json(result);
    })
    .catch((err) => {
      res
        .status(500)
        .json({ err: "Tag has to be unique for every community." });
    });
});

app.delete("/deleteCom/:tag", (req, res) => {
  const tag = req.params.tag;

  const community = db.collection<Communities>("communitie1s");

  community
    .deleteOne({ tag: tag })
    .then((response) => {
      res.status(200).json(response);
    })
    .catch((err) => {
      res
        .status(500)
        .json({ err: "Tag has to be unique for every community." });
    });
});

app.post("/uploadComImage", async (req, res) => {
  const filePath = req.body.image;
  const tag = req.body.tag;
  // console.log(filePath);

  const result = (await cloudinary.uploader
    .upload(filePath, cloudinaryOption)
    .catch((err) => {
      res.status(500).json({ error: err.message });
    })) as UploadApiResponse;

  const ack = await db
    .collection<Communities>("communities")
    .updateOne({ tag: tag }, { $set: { com_image: result.secure_url } });

  res.status(200).json(ack);
});

///events

app.get("/getEvents/:tag", (req, res) => {
  const tag = req.params.tag;
  let events: unknown[] = [];

  db.collection("com_events")
    .find({ tag: tag })
    .sort({ date: 1 })
    .forEach((event) => {
      events.push(event);
    })
    .then(() => {
      res.status(200).json(events);
    })
    .catch(() => res.status(500).json("Could not fetch data"));
});

app.post("/addEvent", async (req, res) => {
  const event = req.body;

  const events = db.collection("com_events");
  events
    .insertOne(event)
    .then((result) => {
      res.status(200).json(result);
    })
    .catch(() => res.status(500).json("Could not insert data"));
});

//uploads

app.get("/get_uploads/:sort/:asc/:tag", (req, res) => {
  const keyword = req.query.key as string;
  const option = req.params.sort;
  const oder = Number(req.params.asc);
  const tag: string = req.params.tag;
  let uploads: unknown[] = [];
  let find: { keywords?: Object; community: string } = {
    community: tag,
  };

  let sort: any = {};
  sort[option] = oder;

  if (keyword) find.keywords = { $regex: `.*${keyword}.*` };

  db.collection("upload_log")
    .find(find)
    .sort(sort)
    .forEach((upload) => {
      uploads.push(upload);
    })
    .then(() => {
      res.status(200).json(uploads);
    })
    .catch(() => res.status(500).json("Could not fetch data"));
});

app.post("/createCategory", (req, res) => {
  const category = req.body;
  const uploads = db.collection("upload_log");

  uploads
    .insertOne(category)
    .then((result) => {
      res.status(200).json(result);
    })
    .catch(() => res.status(500).json("Could not create category"));
});

app.post("/uploadContent/:type/:tag/:name/:uploader", async (req, res) => {
  const file = req.body.file;
  const type = req.params.type;
  const name = req.params.name;
  const uploader = req.params.uploader;
  const tag: string[] = JSON.parse(req.params.tag);
  let upDateFile: any = {
    $push: {},
  };

  const result = (await cloudinary.uploader
    .upload(file, cloudinaryOption)
    .catch((err) => {
      res.status(500).json({ error: err.message });
    })) as UploadApiResponse;

  const updateDocument = {
    name: name,
    date: new Date(),
    uploader: uploader,
    content: result.secure_url,
  };

  upDateFile.$push[type] = updateDocument;
  const upload_log = db.collection<Upload_Log>("upload_log");

  upload_log.updateOne({ keywords: { $all: tag } }, upDateFile);

  const comTag = await db
    .collection<Upload_Log>("upload_log")
    .findOne(
      { keywords: { $all: tag } },
      { projection: { community: 1, _id: 0 } }
    );

  await db
    .collection<Communities>("communities")
    .updateOne({ tag: comTag?.community }, { $inc: { resource: 1 } });
  res.status(200).json(result);
});
