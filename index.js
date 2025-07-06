const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const stripe = require("stripe")(process.env.PAYMENT_GETWAY_KEY);

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

        // ============= DB collection =============
        const db = client.db("PingParcel_DB"); // database name
        const parcelsCollection = db.collection("parcels");
        const paymentsCollection = db.collection("payments");
        const trackingsCollection = db.collection("trackings");
        // ========== DB collection end ==========

        // GET: all parcels or parcels by user, sorted by latest
        app.get("/parcels", async (req, res) => {
            try {
                const userEmail = req.query.email;

                const query = userEmail ? { created_by: userEmail } : {};
                const options = {
                    sort: { createdAt: -1 }, // Newest first
                };

                const parcels = await parcelsCollection
                    .find(query, options)
                    .toArray();
                res.send(parcels);
            } catch (error) {
                console.error("Error fetching parcels:", error);
                res.status(500).send({ message: "Failed to get parcels" });
            }
        });

        // GET: Get a specific parcel by id
        app.get("/parcels/:id", async (req, res) => {
            try {
                const id = req.params.id;

                if (!ObjectId.isValid(id)) {
                    return res
                        .status(400)
                        .send({ message: "Invalid parcel ID" });
                }

                const parcel = await parcelsCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!parcel) {
                    return res
                        .status(404)
                        .send({ message: "Parcel not found" });
                }

                res.send(parcel);
            } catch (error) {
                console.error("Error fetching parcel:", error);
                return res
                    .status(500)
                    .send({ message: "Failed to fetch parcel" });
            }
        });

        // POST: create a new parcel
        app.post("/parcels", async (req, res) => {
            try {
                const newParcel = req.body;
                const result = await parcelsCollection.insertOne(newParcel);
                res.status(201).send(result);
            } catch (error) {
                console.error("Error inserting Parcel:", error);
                res.status(500).send({ message: "Failed to create parcel" });
            }
        });

        // post when user done payment and i will create a payment record on the db
        app.post("/payments", async (req, res) => {
            try {
                const {
                    parcelId,
                    email,
                    amount,
                    paymentMethod,
                    transactionId,
                } = req.body;

                // 1. Update parcel's payment_status
                const updateResult = await parcelsCollection.updateOne(
                    { _id: new ObjectId(parcelId) },
                    {
                        $set: {
                            payment_status: "paid",
                            transactionId,
                            paidAt: new Date(),
                        },
                    }
                );

                if (updateResult.modifiedCount === 0) {
                    return res
                        .status(404)
                        .send({ message: "Parcel not found or already paid" });
                }

                // 2. Insert payment record
                const paymentDoc = {
                    parcelId,
                    email,
                    amount,
                    paymentMethod,
                    transactionId,
                    paid_at_string: new Date().toISOString(),
                    paid_at: new Date(),
                };

                const result = await paymentsCollection.insertOne(paymentDoc);
                res.status(201).send({ insertedId: result.insertedId });
            } catch (error) {
                console.error("Error inserting payment:", error);
                res.status(500).send({ message: "Failed to record payment" });
            }
        });

        // DELETE /parcels/:id
        app.delete("/parcels/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const result = await parcelsCollection.deleteOne({
                    _id: new ObjectId(id),
                });

                if (result.deletedCount === 1) {
                    res.send({ success: true, deletedCount: 1 });
                } else {
                    res.status(404).send({
                        success: false,
                        message: "Parcel not found.",
                    });
                }
            } catch (error) {
                console.error("Delete Error:", error);
                res.status(500).send({
                    success: false,
                    message: "Server error.",
                });
            }
        });

        // GET: Fetch payment history by user email
        app.get("/payments", async (req, res) => {
            try {
                const userEmail = req.query.email;

                const query = userEmail ? { email: userEmail } : {};
                const options = { sort: { paid_at: -1 } }; // Latest first

                const payments = await paymentsCollection
                    .find(query, options)
                    .toArray();
                res.send(payments);
            } catch (error) {
                console.log("Error fetching payment history: ", error);
                res.status(500).send({ message: "Failed to get payments" });
            }
        });

        // track a parcel, api for get and post tracking details
        app.get("/trackings/:trackingId", async (req, res) => {
            const trackingId = req.params.trackingId;

            const updates = await trackingsCollection
                .find({ tracking_id: trackingId })
                .sort({ timestamp: 1 }) // sort by time ascending
                .toArray();

            res.json(updates);
        });

        app.post("/trackings", async (req, res) => {
            const update = req.body;

            update.timestamp = new Date(); // ensure correct timestamp
            if (!update.tracking_id || !update.status) {
                return res
                    .status(400)
                    .json({ message: "tracking_id and status are required." });
            }

            const result = await trackingsCollection.insertOne(update);
            res.status(201).json(result);
        });

        app.post("/tracking", async (req, res) => {
            const {
                tracking_id,
                parcel_id,
                status,
                message,
                updated_by = "",
            } = req.body;

            const log = {
                tracking_id,
                parcel_id: parcel_id ? new ObjectId(parcel_id) : undefined,
                status,
                message,
                time: new Date(),
                updated_by,
            };

            const result = await trackingCollection.insertOne(log);
            res.send({ success: true, insertedId: result.insertedId });
        });

        // PATCH: Mark a parcel as paid
        app.patch("/parcels/:id/pay", async (req, res) => {
            const id = req.params.id;
            const transactionId = req.body.transactionId;

            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: "Invalid ID" });
            }

            const result = await parcelsCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        payment_status: "paid",
                        transactionId: transactionId,
                        paidAt: new Date(),
                    },
                }
            );

            res.send(result);
        });

        // this api for payment
        app.post("/create-payment-intent", async (req, res) => {
            try {
                const amountInCents = req.body.amountInCents;
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amountInCents,
                    currency: "usd",
                    payment_method_types: ["card"],
                });
                res.json({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

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
