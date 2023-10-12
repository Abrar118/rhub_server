import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectdb, get_connection } from "./connection.js";

const app = express();
const port = process.env.PORT;
let db;

app.use(cors());
app.use(express.json());
dotenv.config();

connectdb((error) => {
  if (!error) {
    app.listen(port);
    db = get_connection();
  } else console.error("Database not connected");
});

//students API

app.get("/get_students", (req, res) => {
  let users = [];

  db.collection("users").find().sort({ student_id: 1 }).forEach((user) => {
    users.push(user);
  })
    .then(() => {
      res.status(200).json(users);
    })
    .catch(() => res.status(500).json("Could not fetch data"));
});

app.get("/get_students/:id", (req, res) => {
  const std_id = req.params.id * 1;

  db.collection("users").findOne({ student_id: std_id })
    .then((data) => {
      // console.log(data)
      res.status(200).json(data);
    })
    .catch((error) => {
      res.status(500).json("Could not fetch data");
    });
});

app.get("/getStudentByEmail/:email/:password", (req, res) => {
  const email = req.params.email;
  const password = req.params.password;

  db.collection("users").findOne({ email: email })
    .then((data) => {
      if (data.password === password) {
        if (data.authenticated === 1) res.status(200).json(data);
        else res.status(202).json({ authenticated: 0 })
      }
      else res.status(201).json({ student_id: "-1" });
    })
    .catch((error) => {
      res.status(500).json({ error: "Account not found!" });
    });
});

app.get("/getAuthStatus/:email", (req, res) => {
  const email = req.params.email;

  db.collection("users").findOne({ email: email }, { projection: { authenticated: 1, _id: 0 } })
    .then((data) => {
      res.status(200).json(data);
    })
    .catch((error) => {
      res.status(500).json({ error: "Account not found!" });
    });
});

app.patch("/setAuthStatus", (req, res) => {
  const email = req.body.email;

  db.collection("users").updateOne({ email: email }, { $set: { authenticated: 1 } })
    .then((data) => {
      res.status(200).json(data);
    })
    .catch((error) => {
      res.status(500).json({ error: "Account not found!" });
    });
})

app.post("/insertUser", (req, res) => {
  const user = req.body;

  db.collection("users").insertOne(user)
    .then((result) => {
      res.status(200).json(result);
    })
    .catch((err) => {
      res.status(500).json({ err: "Duplicate Student ID" });
    });
});

app.patch("/updateUser/:studentId", (req, res) => {
  const user = req.body;
  const id = req.params.studentId * 1;

  db.collection("users").updateOne({ student_id: id }, { $set: user })
    .then((result) => {
      res.status(200).json(result);
    })
    .catch((err) => {
      res.status(500).json({ err: "Could not create user" });
    });
});



//community API

app.get("/get_top_communities", (req, res) => {

  let communities = [];

  db.collection("communities").find().sort({ rating: -1 }).limit(3).forEach((community) => {
    communities.push(community);
  })
    .then(() => {
      res.status(200).json(communities);
    })
    .catch(() => res.status(500).json("Could not fetch data"));
});

app.get("/get_all_communities/:sort/:asc", (req, res) => {

  let communities = [];
  const criteria = req.params.sort;
  const asc = req.params.asc * 1;
  const sort = {};
  sort[criteria] = asc || 1;
  const find = {
    "privacy": "open"
  }

  const tag = req.query.tag || null;

  if (tag != null) find["tag"] = tag;

  db.collection("communities").find(find).sort(sort).forEach((community) => {
    communities.push(community);
  })
    .then(() => {
      res.status(200).json(communities);
    })
    .catch(() => res.status(500).json("Could not fetch data"));
});


app.get("/get_my_communities/:sort/:asc/:myTags", (req, res) => {

  let communities = [];
  const criteria = req.params.sort;
  const asc = req.params.asc * 1;
  const myComTags = JSON.parse(req.params.myTags);
  const sort = {};
  sort[criteria] = asc || 1;
  const find = {
    "$and": [
      {
        "tag": { $in: myComTags }
      }
    ]
  }

  const tag = req.query.tag || null;

  if (tag != null) find["$and"].push({ "tag": tag });

  db.collection("communities").find(find).sort(sort).forEach((community) => {
    communities.push(community);
  })
    .then(() => {
      res.status(200).json(communities);
    })
    .catch((error) => res.status(500).json({ message: error.message }));
});


app.get("/get_communityByTag/:tag", (req, res) => {
  const com_tag = req.params.tag;

  db.collection("communities").findOne({ tag: com_tag })
    .then((data) => {
      res.status(200).json(data);
    })
    .catch((error) => {
      res.status(500).json("Could not fetch data");
    });
});

app.post("/insertCommunity", (req, res) => {
  const community = req.body;
  db.collection("communities").insertOne(community)
    .then((result) => {
      res.status(200).json(result);
    })
    .catch((err) => {
      res.status(500).json({ err: "Tag has to be unique for every community." });
    });
});


app.get("/getEvents/:tag", (req, res) => {
  const tag = req.params.tag;
  let events = [];

  db.collection("com_events").find({ tag: tag }).sort({ date: 1 }).forEach((event) => {
    events.push(event);
  })
    .then(() => {
      res.status(200).json(events);
    })
    .catch(() => res.status(500).json("Could not fetch data"));
});