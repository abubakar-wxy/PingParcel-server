const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
require("dotenv").config()
const port = process.env.PORT || 3000;

// ================ Middleware ================
app.use(cors());
app.use(express.json());

// ================================ MongoDB ====================================
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@ping-parcel.emra3wn.mongodb.net/?retryWrites=true&w=majority&appName=ping-parcel`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        // ============= creating API in this section =============

        

        // =================== End End End ==================

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!"
        );
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);
// ================================ end end end =================================
// ============== Server Setup initial code ==============;
app.get("/", (req, res) => {
    res.send("PingParcel server is running!");
});

app.listen(port, () => {
    console.log(`Example app listening on port: ------------- ${port}`);
});
