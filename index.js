const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const app = express()
const cookieParser = require('cookie-parser')
const port = process.env.port || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const corsOptions = {
    origin: ['http://localhost:5173'],
    credentials: true,
    optionSuccessStatus: 200,
}

// middleware
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())


// verify jwt middleware
const verifyToken = async (req, res, next) => {
    console.log('in middleware')
    const token = req.cookies?.token
    if (!token) {
        console.log('in middle ware gaian')
        return res.status(401).send({ message: "unauthorized access | no token" })
    }
    if (token) {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                console.log(err)
                return res.status(401).send({ message: "unauthorized access" })
            }
            console.log('middleware', decoded)
            req.user = decoded
            next()
        })
    }
}



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


        // jwt generate
        app.post('/jwt', async (req, res) => {
            const userEmail = req.body;
            const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            // console.log(token)
            res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict' }).send({ success: true })
        })

        //clear token on logout
        app.get('/logout', async (req, res) => {
            res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict', maxAge: 0 }).send({ success: true })
        })



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

            //check if its a duplicate request
            const query = {
                email: bidData.email,
                jobId: bidData.jobId
            }
            const alreadyApplied = await bidsCollection.findOne(query)

            if (alreadyApplied) {
                return res.status(400).send('You already placed a bid on this job')
            }

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
        app.get('/jobs/:email', verifyToken, async (req, res) => {
            console.log(2111)
            const tokenEmail = req?.user?.email
            const email = req.params.email;
            if (tokenEmail !== email) {
                res.status(403).send({ message: "forbidden access" })
            }
            const query = { 'buyers.email': email }
            const result = await jobsCollection.find(query).toArray();
            res.send(result);
        })

        // delete a job by a specific user
        app.delete('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await jobsCollection.deleteOne(filter)
            res.send(result);

        })

        //update a job listing
        app.put('/job/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const jobData = req.body
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    ...jobData
                }
            }
            const result = await jobsCollection.updateOne(filter, updateDoc, options)
            res.send(result);
        })

        // get all bids made by a user | by email from  db
        app.get('/my-bids/:email', verifyToken, async (req, res) => {
            const tokenEmail = req.user.email
            const email = req.params.email
            if (tokenEmail !== email) {
                res.status(403).send({ message: "forbidden access" })
            }
            const query = { email: email }
            const result = await bidsCollection.find(query).toArray()
            res.send(result);
        })

        //get all bid request from db for job owner
        app.get('/bid-request/:email', verifyToken, async (req, res) => {
            const tokenEmail = req.user?.email
            const email = req.params.email
            if (tokenEmail !== email) {
                res.status(403).send({ message: "forbidden access" })
            }
            const query = { 'buyers.email': email }
            const result = await bidsCollection.find(query).toArray()
            res.send(result);
        })


        //update bid status
        app.patch('/bid/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: status
            }
            const result = await bidsCollection.updateOne(query, updateDoc)
            res.send(result)
        })


        // for pagination get all data count
        app.get('/jobs-count', async (req, res) => {
            const filter = req.query.filter
            const search = req.query.search

            let query = {
                job_title: { $regex: search, $options: 'i' }
            }

            if(filter) query.category=filter

            const count = await jobsCollection.countDocuments(query)
            res.send({ count })
        })

        //for pagination get all data, pagination, filter, search
        app.get('/all-jobs', async (req, res) => {
            const page = parseInt(req.query.page) - 1
            const size = parseInt(req.query.size)
            const sort = req.query.sort
            const search = req.query.search

            //search
            let query = {
                job_title: { $regex: search, $options: 'i' }
            }

            //filter
            const filter = req.query.filter
            if (filter) {
                query.category = filter
            }


            //sort
            let options = {}
            if (sort) {
                options = { sort: { deadline: sort === 'asc' ? 1 : -1 } }
            }

            const result = await jobsCollection.find(query, options).skip(page * size).limit(size).toArray()
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
