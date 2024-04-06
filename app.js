const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const uuid = require('uuid');
const path = require('path');
const PORT = process.env.PORT || 3000;
const logger = require('pino')()
// const http = require('http');
// const socketIo = require("socket.io");
// const app = express();
// const server = http.createServer(app);
// const io = socketIo(server)

const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  },
  
});


io.on('connection', (socket) => {
  logger.info('a user connected');

  socket.on('disconnect', () => {
    logger.info('user disconnected');
  });
});
// MongoDB connection
const connectionURL = 'mongodb+srv://un:ps@cluster0.wklmi.mongodb.net/webhook'
mongoose.connect(connectionURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => logger.info('MongoDB connected'))
  .catch(err => logger.info(err));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 
app.set('view engine', 'ejs');

// Set the directory where the views are stored
app.set('views', path.join(__dirname, 'webhookUI'));


 
const requestSchema = new mongoose.Schema({
  data: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

const WebhookSchema = new mongoose.Schema({
  webhookId: {
    type: String,
    default: uuid.v4()
  },
  requests: [requestSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Webhook = mongoose.model('Webhook', WebhookSchema);


// Route to create a new webhook and display its unique URL
app.get('/new', async (req, res) => {
  const webhook = new Webhook();
  await webhook.save();
  res.render('new', { webhookId: webhook.webhookId });
});

app.all('/webhook/:webhookId', async (req, res) => {
  const { webhookId } = req.params;
  const webhook = await Webhook.findOne({ webhookId: webhookId });

  if (!webhook) {
    return res.status(404).send('Webhook not found');
  }
  const simplifiedRequest = {
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query,
    params: req.params,
    url: req.url,
    protocol: req.protocol,
    host: req.get('host'),
    origin: req.get('origin'),
    referer: req.get('referer'),
    userAgent: req.get('user-agent'),
    ip: req.ip
  };

  webhook.requests.push({
    data : simplifiedRequest
  });

  await webhook.save();
  io.emit('requestReceived', { webhookId, data: simplifiedRequest });
  res.send(`Data saved for webhook: ${webhookId}`);
});


// Route to view data sent to a specific webhook
app.get('/view/:webhookId', async (req, res) => {
  const { webhookId } = req.params;
  const webhook = await Webhook.findOne({ webhookId: webhookId });
  if (!webhook) {
    return res.status(404).send('Webhook not found');
  }

  res.render('view', { data: webhook });
});

app.get('/create-webhook', async (req, res) => {
  const newWebhook = new Webhook();
  await newWebhook.save();
  res.redirect('/');
});

app.get('/', async (req, res) => {
  try {
    // Fetch all webhooks from the database 
    const webhooks = await Webhook.find({});
    const baseUrl = req.protocol + '://' + req.get('host') + '/webhook/';
    res.render('index', { webhooks: webhooks , baseUrl: baseUrl});
  } catch (error) {
      console.error("Failed to fetch webhooks", error);
      res.status(500).send("Error fetching webhooks");
  }
});

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
