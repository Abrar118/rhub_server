import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { v2 as cloudinary, } from "cloudinary";
import { MongoClient, } from "mongodb";
import { loadModel, getContext } from "./NLP.js";
const app = express();
let modelLoaded = false;
let model;
let context;
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));
dotenv.config();
const ATLAS = process.env.ATLAS;
const DATABASE = process.env.DATABASE;
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
    secure: true,
});
const cloudinaryOption = {
    overwrite: true,
    invalidate: true,
    resource_type: "auto",
};
const response = await MongoClient.connect(ATLAS).catch((err) => {
    console.error(err);
});
let db_instance = response?.db(DATABASE);
const db = {
    communities: db_instance.collection("communities"),
    users: db_instance.collection("users"),
    com_events: db_instance.collection("com_events"),
    upload_log: db_instance.collection("upload_log"),
    bookmarks: db_instance.collection("bookmarks"),
    com_request: db_instance.collection("com_request"),
    faqs: db_instance.collection("faqs"),
    passwords: db_instance.collection("passwords"),
    reviews: db_instance.collection("reviews"),
};
//change streams
const communityChangeStream = db.reviews.watch([], { fullDocument: "updateLookup" });
communityChangeStream.on("change", async (changeData) => {
    if (changeData.operationType === "update") {
        const fullDocument = changeData.fullDocument;
        const reviews = fullDocument.reviews;
        const getCommunity = await db.communities.findOne({ tag: fullDocument.tag }, { projection: { rating: 1, _id: 0 } });
        const prevRating = getCommunity?.rating;
        const averageRating = (prevRating + reviews[reviews.length - 1].rating) / reviews.length;
        await db.communities.updateOne({ tag: fullDocument.tag }, { $set: { rating: Math.round(averageRating) } });
    }
});
// server listening
app.listen(process.env.PORT, () => {
    console.log("Server listening to port " + process.env.PORT);
});
//students API
app.get("/get_students", async (req, res) => {
    const users = await db.users
        .find()
        .sort({ student_id: 1 })
        .toArray()
        .catch(() => res.status(500).json("Could not fetch data"));
    res.status(200).json(users);
});
app.get("/get_students/:id", (req, res) => {
    const std_id = Number(req.params.id);
    db.users
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
    let permission = false;
    let status = 0;
    let data = {};
    const user = (await db.users
        .findOne({ email: email })
        .catch((err) => res.status(500).json({ error: err.message })));
    if (!user)
        (status = 201), (data = { student_id: "-1" });
    else if (user?.authenticated === 1)
        (status = 200), (data = user);
    else
        (status = 202), (data = { authenticated: 0 });
    if (user) {
        const fetched_password = (await db.passwords
            .findOne({ student_id: user.student_id })
            .catch((err) => res.status(500).json({ error: err.message })));
        if (fetched_password) {
            if (fetched_password.password === password) {
                permission = true;
            }
            else {
                status = 201;
                data = { student_id: "-1" };
            }
        }
    }
    res.status(status).json(data);
});
app.get("/getAuthStatus/:email", (req, res) => {
    const email = req.params.email;
    db.users
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
    db.users
        .updateOne({ email: email }, { $set: { authenticated: 1 } })
        .then((data) => {
        res.status(200).json(data);
    })
        .catch((error) => {
        res.status(500).json({ error: "Account not found!" });
    });
});
app.post("/insertUser", async (req, res) => {
    const user = req.body;
    const password = user.password;
    delete user.password;
    const inserted = (await db.users.insertOne(user).catch((err) => {
        res.status(500).json({ err: "Duplicate Student ID or email" });
    }));
    if (inserted.acknowledged) {
        await db.passwords
            .insertOne({
            student_id: user.student_id,
            password: password,
            oldPassword: "",
        })
            .catch((err) => {
            res.status(500).json({ err: "Could not create user" });
        });
        res.status(200).json(inserted);
    }
});
app.patch("/updateUser/:studentId", (req, res) => {
    const user = req.body;
    const id = Number(req.params.studentId);
    db.users
        .updateOne({ student_id: id }, { $set: user })
        .then((result) => {
        res.status(200).json(result);
    })
        .catch((err) => {
        res.status(500).json({ err: "Could not create user" });
    });
});
app.patch("/updatePassword/:studentId", async (req, res) => {
    const studentId = Number(req.params.studentId);
    const password = req.body.password;
    const response = await db.passwords.findOne({ student_id: studentId });
    if (response) {
        if (password === response.oldPassword || password === response.password)
            res.status(201).json("Old password and new password cannot be same");
        else {
            await db.passwords.updateOne({ student_id: studentId }, { $set: { password: password, oldPassword: response.password } });
            res.status(200).json("Password updated");
        }
    }
    else
        res.status(500).json("Could not update password");
});
app.patch("/addComToUser", (req, res) => {
    const user = req.body.userId;
    const tag = req.body.tag;
    db.users
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
//community APIs
app.get("/get_top_communities", async (req, res) => {
    const communities = await db.communities
        .find({ privacy: "open" })
        .sort({ rating: -1 })
        .limit(3)
        .toArray()
        .catch(() => res.status(500).json("Could not fetch data"));
    res.status(200).json(communities);
});
app.get("/get_all_communities/:sort/:asc/:page", async (req, res) => {
    const criteria = req.params.sort;
    const asc = Number(req.params.asc) === 1 ? 1 : -1;
    const page = Number(req.params.page);
    const comPerPage = Number(8);
    let sort = {};
    if (criteria === "name")
        sort["name"] = asc;
    else if (criteria === "rating")
        sort["rating"] = asc;
    else if (criteria === "members")
        sort["members"] = asc;
    else
        sort.resource = asc;
    let find = {
        privacy: "open",
    };
    const tag = req.query.tag;
    if (tag)
        find.tag = { $regex: `.*${tag}.*` };
    const data = db.communities;
    const numberOfCom = await data.countDocuments(find);
    const communities = await data
        .find(find)
        .skip(comPerPage * page)
        .limit(comPerPage)
        .sort(sort)
        .toArray()
        .catch(() => res.status(500).json("Could not fetch data"));
    res.status(200).json({ communities: communities, total: numberOfCom });
});
app.get("/get_my_communities/:sort/:asc/:myTags/:page", async (req, res) => {
    let communities = [];
    const criteria = req.params.sort;
    const asc = Number(req.params.asc);
    const myComTags = JSON.parse(req.params.myTags);
    const page = Number(req.params.page);
    const comPerPage = Number(3);
    const sort = {};
    sort[criteria] = asc || 1;
    const find = {
        $and: [
            {
                tag: { $in: myComTags },
            },
        ],
    };
    const tag = req.query.tag;
    if (tag)
        find.$and.push({ tag: { $regex: `.*${tag}.*` } });
    const data = db.communities;
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
    db.communities
        .findOne({ tag: com_tag })
        .then((data) => {
        res.status(200).json(data);
    })
        .catch((error) => {
        res.status(500).json("Could not fetch data");
    });
});
app.post("/insertCommunity", async (req, res) => {
    const community = req.body;
    const response = await db.communities.insertOne(community).catch((err) => {
        res.status(500).json({ err: "Tag has to be unique for every community." });
    });
    if (response) {
        await db.reviews.insertOne({ tag: community.tag, reviews: [] });
    }
    res.status(200).json(response);
});
app.get("/getAdmin/:tag", async (req, res) => {
    const comTag = req.params.tag;
    const admin = await db.communities.findOne({ tag: comTag }, { projection: { admin: 1, name: 1, _id: 0 } });
    res.status(200).json({ admin: admin?.admin, name: admin?.name });
});
app.delete("/deleteCom/:tag", async (req, res) => {
    const tag = req.params.tag;
    const deletedCom = await db.communities.deleteOne({ tag: tag }).catch(() => {
        res.status(500).json("Could not delete community");
    });
    if (deletedCom) {
        await db.reviews.deleteOne({ tag: tag }).catch(() => {
            res.status(500).json("Could not delete reviews");
        });
        await db.com_events.deleteMany({ tag: [tag] }).catch(() => {
            res.status(500).json("Could not delete events");
        });
        await db.com_events
            .updateMany({ tag: tag }, { $pull: { tag: tag } })
            .catch(() => {
            res.status(500).json("Could not delete events");
        });
        await db.com_request.deleteMany({ tag: tag }).catch(() => {
            res.status(500).json("Could not delete requests");
        });
        await db.bookmarks.deleteMany({ comTag: tag }).catch(() => {
            res.status(500).json("Could not delete bookmarks");
        });
        await db.upload_log.deleteMany({ community: tag }).catch(() => {
            res.status(500).json("Could not delete uploads");
        });
        await db.users
            .updateMany({ community: tag }, { $pull: { community: tag } })
            .catch(() => {
            res.status(500).json("Could not delete com from users");
        });
    }
    res.status(200).json(deletedCom);
});
app.post("/uploadComImage", async (req, res) => {
    const filePath = req.body.image;
    const tag = req.body.tag;
    // console.log(filePath);
    const result = (await cloudinary.uploader
        .upload(filePath, cloudinaryOption)
        .catch((err) => {
        res.status(500).json({ error: err.message });
    }));
    const ack = await db.communities.updateOne({ tag: tag }, { $set: { com_image: result.secure_url } });
    res.status(200).json(ack);
});
app.post("/insertRequest", async (req, res) => {
    const request = req.body;
    const response = await db.users
        .findOne({ email: request.email, community: request.tag })
        .catch(() => res.status(501).json("Could not fetch data"));
    if (response) {
        res.status(201).json("Already requested");
        return;
    }
    db.com_request
        .insertOne(request)
        .then((result) => {
        res.status(200).json(result);
    })
        .catch(() => res.status(500).json("Could not insert data"));
});
app.get("/getRequests/:tag", async (req, res) => {
    const tag = req.params.tag;
    const data = await db.com_request
        .find({ tag: tag })
        .sort({ date: -1 })
        .toArray()
        .catch(() => res.status(500).json("Could not fetch data"));
    res.status(200).json(data);
});
app.patch("/handleRequest", async (req, res) => {
    const confirm = req.body.confirm === "yes";
    const tag = req.body.tag;
    const user = req.body.id;
    if (confirm) {
        await db.users
            .updateOne({ student_id: user }, { $push: { community: tag } })
            .catch(() => res.status(500).json("Could not update data"));
    }
    const response = await db.com_request
        .deleteOne({ tag: tag, id: user })
        .catch(() => res.status(500).json("Could not delete data"));
    res.status(200).json(response);
});
app.patch("/rateCom/:tag", async (req, res) => {
    const review = req.body;
    const tag = req.params.tag;
    const response = await db.reviews
        .updateOne({ tag: tag }, { $push: { reviews: review } })
        .catch(() => res.status(500).json("Could not insert data"));
    res.status(200).json(response);
});
///events
app.get("/getEvents/:tag", (req, res) => {
    const tag = req.params.tag;
    let events = [];
    db.com_events
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
    const events = db.com_events;
    events
        .insertOne(event)
        .then((result) => {
        res.status(200).json(result);
    })
        .catch(() => res.status(500).json("Could not insert data"));
});
app.patch("/addComment/:tag/:date", async (req, res) => {
    const comment = req.body;
    const tag = JSON.parse(req.params.tag);
    const date = req.params.date;
    const events = db.com_events;
    events
        .updateOne({ tag: { $all: tag }, date: date }, { $push: { comments: comment } })
        .then((result) => {
        res.status(200).json(result);
    })
        .catch(() => res.status(500).json("Could not insert data"));
});
//uploads
app.get("/get_uploads/:sort/:asc/:tag", (req, res) => {
    const keyword = req.query.key;
    const option = req.params.sort;
    const oder = Number(req.params.asc);
    const tag = req.params.tag;
    let uploads = [];
    let find = {
        community: tag,
    };
    let sort = {};
    sort[option] = oder;
    if (keyword)
        find.keywords = { $regex: `.*${keyword}.*` };
    db.upload_log
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
app.get("/get_upload/:keywords/:tag", async (req, res) => {
    const keyword = JSON.parse(req.params.keywords);
    const tag = req.params.tag;
    const upload = await db.upload_log
        .findOne({ keywords: { $all: keyword }, community: tag })
        .catch(() => res.status(500).json("Could not fetch"));
    res.status(200).json(upload);
});
app.get("/get_uploadByTitle/:title/:dateCreated", async (req, res) => {
    const title = req.params.title;
    const dateCreated = req.params.dateCreated;
    const upload = await db.upload_log
        .findOne({ category_name: title, date: dateCreated })
        .catch(() => res.status(500).json("Could not fetch"));
    res.status(200).json(upload);
});
app.post("/createCategory", (req, res) => {
    const category = req.body;
    const uploads = db.upload_log;
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
    const tag = JSON.parse(req.params.tag);
    let upDateFile = {
        $push: {},
    };
    const result = (await cloudinary.uploader
        .upload(file, cloudinaryOption)
        .catch((err) => {
        res.status(500).json({ error: err.message });
    }));
    const updateDocument = {
        name: name,
        date: new Date().toISOString(),
        uploader: uploader,
        content: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        type: result.type,
    };
    upDateFile.$push[type] = updateDocument;
    const upload_log = db.upload_log;
    upload_log.updateOne({ keywords: { $all: tag } }, upDateFile);
    const comTag = await db.upload_log.findOne({ keywords: { $all: tag } }, { projection: { community: 1, _id: 0 } });
    await db.communities.updateOne({ tag: comTag?.community }, { $inc: { resource: 1 } });
    res.status(200).json(result);
});
app.delete("/deleteContent/:publicId/:time/:tag/:type/:resourceType/:mainListType", async (req, res) => {
    const public_id = req.params.publicId;
    const uploadTime = req.params.time;
    const tag = req.params.tag;
    const type = req.params.type;
    const resourceType = req.params.resourceType;
    const mainListType = req.params.mainListType;
    const deleteOptions = {
        type: type,
        resource_type: resourceType,
    };
    await cloudinary.api
        .delete_resources([public_id], deleteOptions, async (err, result) => {
        if (err)
            res.status(500).json({ error: err.message });
        else {
            const delete_content = { publicId: public_id };
            const delete_object = {};
            delete_object[mainListType] = delete_content;
            const deleted = await db.upload_log.updateOne({ date: uploadTime }, { $pull: delete_object });
            await db.communities.updateOne({ tag: tag }, { $inc: { resource: -1 } });
            res.status(200).json(deleted);
        }
    })
        .catch((error) => {
        res.status(201).json(error.message);
    });
});
app.post("/changeAccess", async (req, res) => {
    const access = req.body.access;
    const keywords = req.body.keywords;
    const response = await db.upload_log.updateOne({ keywords: { $all: keywords } }, { $set: { access: access } });
    res.status(200).json(response);
});
app.post("/insertBookmark", async (req, res) => {
    const bookmark = req.body;
    const response = await db.bookmarks.insertOne(bookmark).catch((err) => {
        res.status(500).json({ error: err.message });
    });
    res.status(200).json(response);
});
app.get("/getBookmarks/:userId/:sortOption/:order", async (req, res) => {
    const userId = Number(req.params.userId);
    const sortOption = req.params.sortOption;
    const order = Number(req.params.order);
    const title = req.query.title;
    const sort = {};
    sort[sortOption] = order;
    let find = {
        user: userId,
    };
    if (title)
        find.title = { $regex: `.*${title}.*`, $options: "i" };
    const response = await db.bookmarks
        .find(find)
        .sort(sort)
        .toArray()
        .catch((err) => {
        res.status(500).json({ error: err.message });
    });
    res.status(200).json(response);
});
app.delete("/deleteBookmark/:userId/:title", async (req, res) => {
    const userId = Number(req.params.userId);
    const title = req.params.title;
    const response = await db.bookmarks
        .deleteOne({ user: userId, title: title })
        .catch((err) => {
        res.status(500).json({ error: err.message });
    });
    res.status(200).json(response);
});
//FAQs
app.get("/get_faqs", async (req, res) => {
    const response = await db.faqs
        .find({})
        .toArray()
        .catch(() => res.status(500).json("Could not fetch data"));
    res.status(200).json(response);
});
//AI chat
app.get("/loadModel", async (req, res) => {
    let terminate = false;
    console.log(modelLoaded);
    if (!modelLoaded) {
        const temp_model = (await loadModel().catch((err) => {
            res.status(500).json({ error: err.message });
            terminate = true;
            console.log("model not loaded");
        }));
        if (terminate)
            return;
        modelLoaded = true;
        model = temp_model;
        context = getContext();
    }
    res.status(200).json(true);
});
app.post("/getAnswer", async (req, res) => {
    const question = req.body.question;
    const answers = await model.findAnswers(question, context);
    let maxScore = 0;
    let answer = "";
    answers.forEach((ans) => {
        if (ans.score > maxScore) {
            maxScore = ans.score;
            answer = ans.text;
        }
    });
    res.status(200).json(answer);
});
