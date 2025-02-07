const express = require("express")
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');




const app = express();
const PORT = process.env.PORT || 3000;

//middle ware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');


//session
const sessionMiddleware = session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // MAKE TRUE IF USING HTTPS.
  });
  app.use(sessionMiddleware);


//database
let users = [];
let messages = [];

// http & attach socket
const server = http.createServer(app);
const io = new Server(server)



io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, (err) => {
        if (err) return next(err);
        socket.handshake.session = socket.request.session;
        next();
    })
})


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.get('/', (req, res) => {
    if (req.session.user) {
      res.render('home', { username: req.session.user.username });
    } else {
      res.redirect('/login');
    }
  });


  app.get('/login', (req, res) => {
    res.render('login');
  });

  
  app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
  
    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.user = user;
      res.redirect('/');
    } else {
      res.send('Invalid username or password');
    }
  });


  app.get('/signup', (req, res) => {
    res.render('signup');
  });


  app.post('/signup', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
  
    users.push({ username, password: hashedPassword });
    res.redirect('/login');
  });
  
  app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
  });

  

  io.on('connection', (socket) => {
    console.log('a user connected');
  
    const user = socket.handshake.session.user;
    if (user) {
      console.log(`${user.username} connected`);
      
      socket.broadcast.emit('user connected', { username: user.username });
  
      socket.emit('chat history', messages);
    }
  
    socket.on('chat message', (msg) => {
      messages.push(msg); // save message
      io.emit('chat message', msg); // show everyone message
    });
  
    // image uploads
    socket.on('image upload', (data) => {
      const { username, imageData } = data;
      const fileName = `image_${Date.now()}.jpg`;
      const filePath = path.join(uploadDir, fileName);
  
      fs.writeFile(filePath, imageData, 'base64', (err) => {
        if (err) {
          console.error('Error saving image:', err);
          return;
        }
  
        const imageUrl = `/uploads/${fileName}`;
        const message = { username, text: '', imageUrl };
        messages.push(message);
        io.emit('chat message', message);
      });
    });
  
    // user disconnection
    socket.on('disconnect', () => {
      if (user) {
        console.log(`${user.username} disconnected`);
                socket.broadcast.emit('user disconnected', { username: user.username });
      }
    });
  });
  
  // Start server
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });