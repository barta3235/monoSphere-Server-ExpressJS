const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const app = express()
const port = process.env.port || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// password:   0RkVpzlnM068PtJu

const corsOptions = {
    origin: ['http://localhost:5173'],
    credentials: true,
    optionSuccessStatus: 200,
}

// middleware
app.use(cors(corsOptions))
app.use(express.json())

console.log(process.env.DB_USER)

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.n2g3mj5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        //   await client.connect();

        const jobsCollection = client.db('monoSphere').collection('jobs')
        const bidsCollection = client.db('monoSphere').collection('bids')

        //get all job data from db
        app.get('/jobs', async (req, res) => {
            const result = await jobsCollection.find().toArray()
            res.send(result);
        })

        //get a single job data from db using job id
        app.get('/job/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await jobsCollection.findOne(query);
            res.send(result);
        })

        // save a bid data in db
        app.post('/bid', async (req, res) => {
            const bidData = req.body;
            const result = await bidsCollection.insertOne(bidData);
            res.send(result);
        })

        //add a job into db
        app.post('/jobs', async (req, res) => {
            const jobData = req.body;
            const result = await jobsCollection.insertOne(jobData);
            res.send(result);
        })

        // get all jobs posted  by a specific user
        app.get('/jobs/:email', async (req, res) => {
            const email = req.params.email;
            const query = { 'buyers.email': email }
            const result = await jobsCollection.find(query).toArray();
            res.send(result);
        })

        // delete a job by a specific user
        app.delete('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result= await jobsCollection.deleteOne(filter)
            res.send(result);
            
        })

        //update a job listing
        app.put('/job/:id',async(req,res)=>{
            const id= req.params.id;
            const filter={_id: new ObjectId(id)}
            const jobData=req.body
            const options={upsert:true};
            const updateDoc={
                $set:{
                    ...jobData
                }
            }
            const result =await jobsCollection.updateOne(filter,updateDoc,options)
            res.send(result);
        })








        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //   await client.close();
    }
}
run().catch(console.dir);


app.get('/', async (req, res) => {
    res.send("Server Working")
})

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
})
