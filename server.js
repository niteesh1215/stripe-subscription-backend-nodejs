// This is your test secret API key.
const stripe = require('stripe')('secret key');
const express = require('express');
const cors = require('cors');
const app = express();
//app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

//const YOUR_DOMAIN = 'http://localhost:4242';
//const clientDomain = 'http://localhost:4200';

const root = { root: './public' };

const priceIds = {
  'STARTER': 'price_1KRXrxCV0Dl0ZhvSYc9DOHa9',
  'STANDARD': 'price_1KRXp8CV0Dl0ZhvSQsEKN3wV',
  'PLUS': 'price_1KRXpzCV0Dl0ZhvS3nm3HByL'
}

console.log(priceIds)

app.get('/', (req, res) => {
  res.send('Hello world');
})

//https://stripe.com/docs/api/customers/create
app.post('/create-customer', async (req, res) => {
  // Create a new customer object
  const response = await createCustomer(req.body.email, req.body.name);
  if (response.customer) {
    res.send({ customer: response.customer });
  } else {
    res.statusCode(500);
    res.send({ error: response.error })
  }
});


//https://stripe.com/docs/api/subscriptions
app.post('/create-subscription', async (req, res) => {
  // Simulate authenticated user. In practice this will be the
  // Stripe Customer ID related to the authenticated user.
  try {
    const customerId = req.body.customerId;

    const priceId = priceIds[req.body.plan];

    if (!customerId) {
      throw 'customer id not found';
    }

    if (!priceId) {
      throw 'plan not found';
    }


    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: priceId,
      }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    res.send({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
    });
  } catch (error) {
    return res.status(400).send({ error: { message: error.message } });
  }
});


app.get('/get-subscription', async (req, res) => {
  try {
    const subscriptionId = req.query.sId;
    //console.log('subscriptionid :', subscriptionId);
    if (!subscriptionId) {
      throw 'subscription id not provided';
    }

    const subscription = await stripe.subscriptions.retrieve(
      subscriptionId
    );

    const priceId = subscription.items.data[0].price.id;

    let plan;

    for (let k in priceIds) {
      if (priceIds[k] == priceId) {
        plan = k;
        break;
      }
    }

    //console.log(subscription);

    res.send({ plan, subscription });

  } catch (e) {
    console.log(e);
    return res.status(500).send({ error: { message: e.message } });
  }
})

app.delete('/del-subscription', async (req, res) => {
  try {

    const subscriptionId = req.query.sId;
    console.log('subscriptionid :', subscriptionId);
    if (!subscriptionId) {
      throw 'subscription id not provided';
    }

    //stripe.subscriptions.update(subscriptionId, {cancel_at_period_end: true});

    const deletedSubscription = await stripe.subscriptions.del(
      subscriptionId
    );

    res.send({ subscription: deletedSubscription });
  } catch (error) {
    return res.status(400).send({ error: { message: error.message } });
  }
});


app.post('/update-subscription', async (req, res) => {
  try {
    const subscriptionId = req.body.sId;
    const priceId = priceIds[req.body.newPlan];


    //console.log('subscriptionid :', subscriptionId);
    if (req.body.currenPlan) {
      throw 'current plan not provided';
    }

    if (!subscriptionId) {
      throw 'subscription id not provided';
    }

    if (!priceId) {
      throw 'plan not found';
    }

    let proration_behavior = 'create_prorations';

    switch (req.body.currenPlan) {
      case 'STARTER': break;
      case 'STANDARD': {
        if (newPlan == 'STARTER') {
          proration_behavior = 'none';
        } break;
      }
      case 'PLUS': proration_behavior = 'none'; break;
    }

    const subscription = await stripe.subscriptions.retrieve(
      subscriptionId
    );
    const updatedSubscription = await stripe.subscriptions.update(
      subscriptionId, {
      cancel_at_period_end: false,
      items: [{
        id: subscription.items.data[0].id,
        price: priceId,
      }],
      proration_behavior: proration_behavior
    }
    );

    res.send({ subscription: updatedSubscription });
  } catch (error) {
    res.status(400).send({ error: { message: error.message } });
  }
});


app.post('/invoice-preview', async (req, res) => {
  try {
    const customerId = req.body.customerId;

    const priceId = priceIds[req.body.plan];

    const subscriptionId = req.body.subscriptionId;

    if (!customerId) {
      throw 'customer id not found';
    }

    if (!priceId) {
      throw 'plan not found';
    }

    if (!subscriptionId) {
      throw 'subscription id not provided';
    }

    const subscription = await stripe.subscriptions.retrieve(
      subscriptionId
    );

    const invoice = await stripe.invoices.retrieveUpcoming({
      customer: customerId,
      subscription: subscriptionId,
      // subscription_items: [{
      //   id: subscription.items.data[0].id,
      //   price: priceId,
      // }],
    });

    res.send({ invoice });
  } catch (error) {
    res.status(400).send({ error: { message: error.message } });
  }
});

app.get('/subscriptions', async (req, res) => {
  // Simulate authenticated user. In practice this will be the
  // Stripe Customer ID related to the authenticated user.
  const customerId = req.cookies['customer'];

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    expand: ['data.default_payment_method'],
  });

  res.json({ subscriptions });
});

async function createCustomer(email, name) {
  try {
    const customer = await stripe.customers.create({
      email: email,
      name: name,
      metadata: {
        iticksId: 'demoIticksId'
      }
    });
    return { customer };
  } catch (e) {
    return { error: { message: 'unable to create the customer' } };
  }
}

// app.post('/create-checkout-session', async (req, res) => {

//   try {
//     const priceId = priceIds[req.body.plan];
//     const email = req.body.email;

//     console.log(email, ' emdslf ', priceId);

//     if (!priceId) {
//       throw 'Unknown plan';
//     }

//     if (!email) {
//       throw 'Email not provided';
//     }

//     const res = await createCustomer(email);
//     if (res.error) {
//       throw 'could not create the customer';
//     }

//     console.log('Customer id: ', res.customer.id)
//     // See https://stripe.com/docs/api/checkout/sessions/create
//     // for additional parameters to pass.
//     const session = await stripe.checkout.sessions.create({
//       customer: res.customer.id,
//       //customer_email: email,
//       mode: 'subscription',
//       payment_method_types: ['card'],
//       line_items: [
//         {
//           price: priceId,
//           // For metered billing, do not pass quantity
//           quantity: 1,
//         },
//       ],
//       // {CHECKOUT_SESSION_ID} is a string literal; do not change it!
//       // the actual Session ID is returned in the query parameter when your customer
//       // is redirected to the success page.
//       success_url: `${clientDomain}?payment_status=completed&session_id={CHECKOUT_SESSION_ID}`,
//       cancel_url: `${clientDomain}?payment_status=cancelled`,
//     });

//     console.log('session id ', session);

//     res.send({
//       customer_id: res.customer.id,
//       id: session.id,
//     });
//   } catch (e) {
//     res.status(400);
//     console.log(
//       'An error occured'
//     );
//     return res.send({
//       error: {
//         message: e.message,
//       }
//     });
//   }
// });

// app.get('/success', (req, res) => {
//   res.sendFile('success.html', root);
// })

// app.get('/cancel', (req, res) => {
//   res.sendFile('cancel.html', root);
// })

// app.post('/create-portal-session', async (req, res) => {
//   // For demonstration purposes, we're using the Checkout session to retrieve the customer ID.
//   // Typically this is stored alongside the authenticated user in your database.
//   const { session_id } = req.body;
//   const checkoutSession = await stripe.checkout.sessions.retrieve(session_id);

//   // This is the url to which the customer will be redirected when they are done
//   // managing their billing with the portal.
//   const returnUrl = YOUR_DOMAIN;

//   console.log('checkout sesstion ', checkoutSession);

//   const portalSession = await stripe.billingPortal.sessions.create({
//     customer: checkoutSession.customer,
//     return_url: returnUrl,
//   });

//   res.redirect(303, portalSession.url);
// });




// app.get('/',(req,res)=>{
//   res.sendFile('checkout.html',root)
// })

// app.get('/success',(req,res)=>{
//   res.sendFile('success.html',root);
// })

// app.get('/cancel',(req,res)=>{
//   res.sendFile('cancel.html',root);
// })

// app.post('/create-checkout-session', async (req, res) => {
//   const prices = await stripe.prices.list({
//     lookup_keys: [req.body.lookup_key],
//     expand: ['data.product'],
//   });
//   const session = await stripe.checkout.sessions.create({
//     billing_address_collection: 'auto',
//     line_items: [
//       {
//         price: prices.data[0].id,
//         // For metered billing, do not pass quantity
//         quantity: 1,

//       },
//     ],
//     mode: 'subscription',
//     success_url: `${YOUR_DOMAIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
//     cancel_url: `${YOUR_DOMAIN}/cancel.html`,
//   });

//   res.redirect(303, session.url);
// });

// app.post('/create-portal-session', async (req, res) => {
//   // For demonstration purposes, we're using the Checkout session to retrieve the customer ID.
//   // Typically this is stored alongside the authenticated user in your database.
//   const { session_id } = req.body;
//   const checkoutSession = await stripe.checkout.sessions.retrieve(session_id);

//   // This is the url to which the customer will be redirected when they are done
//   // managing their billing with the portal.
//   const returnUrl = YOUR_DOMAIN;

//   const portalSession = await stripe.billingPortal.sessions.create({
//     customer: checkoutSession.customer,
//     return_url: returnUrl,
//   });

//   res.redirect(303, portalSession.url);
// });

// app.post(
//   '/webhook',
//   express.raw({ type: 'application/json' }),
//   (request, response) => {
//     const event = request.body;
//     // Replace this endpoint secret with your endpoint's unique secret
//     // If you are testing with the CLI, find the secret by running 'stripe listen'
//     // If you are using an endpoint defined with the API or dashboard, look in your webhook settings
//     // at https://dashboard.stripe.com/webhooks
//     const endpointSecret = 'whsec_12345';
//     // Only verify the event if you have an endpoint secret defined.
//     // Otherwise use the basic event deserialized with JSON.parse
//     if (endpointSecret) {
//       // Get the signature sent by Stripe
//       const signature = request.headers['stripe-signature'];
//       try {
//         event = stripe.webhooks.constructEvent(
//           request.body,
//           signature,
//           endpointSecret
//         );
//       } catch (err) {
//         console.log(`⚠️  Webhook signature verification failed.`, err.message);
//         return response.sendStatus(400);
//       }
//     }
//     let subscription;
//     let status;
//     // Handle the event
//     switch (event.type) {
//       case 'customer.subscription.trial_will_end':
//         subscription = event.data.object;
//         status = subscription.status;
//         console.log(`Subscription status is ${status}.`);
//         // Then define and call a method to handle the subscription trial ending.
//         // handleSubscriptionTrialEnding(subscription);
//         break;
//       case 'customer.subscription.deleted':
//         subscription = event.data.object;
//         status = subscription.status;
//         console.log(`Subscription status is ${status}.`);
//         // Then define and call a method to handle the subscription deleted.
//         // handleSubscriptionDeleted(subscriptionDeleted);
//         break;
//       case 'customer.subscription.created':
//         subscription = event.data.object;
//         status = subscription.status;
//         console.log(`Subscription status is ${status}.`);
//         // Then define and call a method to handle the subscription created.
//         // handleSubscriptionCreated(subscription);
//         break;
//       case 'customer.subscription.updated':
//         subscription = event.data.object;
//         status = subscription.status;
//         console.log(`Subscription status is ${status}.`);
//         // Then define and call a method to handle the subscription update.
//         // handleSubscriptionUpdated(subscription);
//         break;
//       default:
//         // Unexpected event type
//         console.log(`Unhandled event type ${event.type}.`);
//     }
//     // Return a 200 response to acknowledge receipt of the event
//     response.send();
//   }
// );

app.listen(4242, () => console.log('Running on port 4242'));