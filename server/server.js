import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

import { initializeApp } from 'firebase/app';
import { getFirestore } from "firebase/firestore";
import { collection, getDocs, addDoc } from "firebase/firestore"; 
import { getAuth, onAuthStateChanged ,createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_KEY);

const firebaseConfig = {
    apiKey: process.env.API_KEY,
    authDomain: process.env.AUTH_DOMAIN,
    projectId: process.env.PROJECT_ID,
    storageBucket: process.env.STORAGE_BUCKET,
    messagingSenderId: process.env.MESSAGING_SENDER_ID,
    appId: process.env.APP_ID
};
  
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const auth = getAuth();

const expressApp = express()
expressApp.use(cors());
expressApp.use(bodyParser.json())
expressApp.use(cookieParser())

//#Auth Functions
expressApp.post('/api/sign-up', async (req, res) => {
    try { 
        await createUserWithEmailAndPassword(auth, req.body.email, req.body.password);
        await signInWithEmailAndPassword(auth, req.body.email, req.body.password);
        res.status(200).send("New User is Added Successfully")
    } catch (error) {
        res.status(400).send(`New User isn't Added Successfully ${error.message}`)
        console.log(error.message)
    }
})

expressApp.get("/api/sign-out", async(req, res) => {
    try {
        await auth.signOut()
        res.sendStatus(200)
    } catch (error) {
        console.log(error)
        res.sendStatus(400)
    }
})

expressApp.post('/api/login', async (req, res) => {
    try {
        await signInWithEmailAndPassword(auth, req.body.email, req.body.password);
        res.status(200).send("User is Logged in Successfully")
    } catch (error) {
        res.status(400).send(`New User isn't Logged in Successfully ${error.message}`)
        console.log(error.message)
    }
})

expressApp.get("/api/check-session", async (req, res) => {
    try {
        const userPromise = new Promise((resolve, reject) => {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    resolve(user);
                } else {
                    reject(new Error("User is not logged in"));
                }
            });
        });
        const user = await userPromise;
        res.status(200).send({ message: "User is logged in", user: user.email });
    } catch (error) {
        console.log(error);
        res.status(401).send({ message: "User is not logged in" });
    }
});
//#

//#Houses Apis 

expressApp.get("/api/get-houses", async (req, res) => {
    try {
        const querySnapshot = await getDocs(collection(db, "houses"));
        const houses = [];

        querySnapshot.forEach((doc) => {
            houses.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.json(houses);
    } catch (error) {
        res.status(500).send(`Error getting houses: ${error.message}`);
    }
});

expressApp.post("/api/purchase", async (req, res) => {
    try {
        let houseId = req.body.id;
        const querySnapshot = await getDocs(collection(db, "houses"));
        let house;

        querySnapshot.forEach((doc) => {
            if (doc.id == houseId) {
                house = doc.data();
            }
        });

        if (house) {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ["card"],
                mode: "payment",
                line_items: [
                    {
                        price_data: {
                            currency: 'eur',
                            product_data: {
                                name: house.name,
                            },
                            unit_amount: house.price*100,
                        },
                        quantity: 1,
                    },
                ],
                success_url: `http://127.0.0.1:5500/frontend/success.html`,
                cancel_url: `http://127.0.0.1:5500/frontend/cancel.html`,
            });

            res.json({ url: session.url });
        } else {
            res.status(404).send("House not found");
        }
    } catch (error) {
        res.status(500).send(`Error processing purchase: ${error.message}`);
    }
});

expressApp.post("/api/buy-membership", async (req, res) => {
    const querySnapshot = await getDocs(collection(db, "users-with-membership"));
    const premiumUsers = [];

    querySnapshot.forEach((doc) => {
        premiumUsers.push({
            id: doc.id,
            ...doc.data()
        });
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            let email = user.email;

            premiumUsers.forEach(async(premiumUser) => {
                if (email!=premiumUser.mail) {
                    try{
                        const session = await stripe.checkout.sessions.create({
                            payment_method_types: ["card"],
                            mode: "subscription",
                            line_items: [
                                {
                                    price_data: {
                                        currency: 'eur',
                                        recurring: {
                                            interval: 'month',
                                        },
                                        product_data: {
                                            name: "Grotn Membership",
                                        },
                                        unit_amount: 10*100,
                                    },
                                    quantity: 1,
                                },
                            ],
                            success_url: `http://127.0.0.1:5500/frontend/success.html`,
                            cancel_url: `http://127.0.0.1:5500/frontend/cancel.html`,
                        });
                    
                        res.json({ url: session.url });
                    }
                    catch (error) {
                        res.status(500).send(`Error processing purchase: ${error.message}`);
                    }
                }
            })
        } else {
            console.log("User not logged in")
        }
    })
});
//#

//#Message Apis
    expressApp.get("/api/get-messages", async (req, res) => {
        try {
            const querySnapshot = await getDocs(collection(db, "messages"));
            const messages = [];
    
            querySnapshot.forEach((doc) => {
                messages.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
    
            res.json(messages);
        } catch (error) {
            console.log(error)
            res.status(500).send(`Error getting houses: ${error.message}`);
        }
    })

    expressApp.get("/api/get-username", async (req, res) => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                let email = user.email;
                let username = email.split("@")[0]

                res.send(username)
            } else {
                console.log("User not logged in")
            }
        })
    })

    expressApp.post("/api/send-message", async (req, res) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                let email = user.email;
                let username = email.split("@")[0]

                try {
                    const docRef = await addDoc(collection(db, "messages"), {
                        text: req.body.text,
                        user: username,
                    });
                  } catch (e) {
                        console.error("Error adding document: ", e);
                  } 
            } else {
                console.log("User not logged in")
            }
        })
        res.sendStatus(200)
    })
//#

expressApp.listen(8080, (err) => {
    if (err) {
        console.log(err);
    } 
    console.log("Server listening on 8080");
})