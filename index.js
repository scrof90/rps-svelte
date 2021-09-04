const port = 3000;

var express = require('express');
var cors = require('cors');
var app = express();

app.use(cors());

app.use(express.json());

app.post('/session/save', function (request, response) {
  console.log(request.body); // your JSON
  response.send(request.body); // echo the result back
});

app.get('/', (req, res) => {
  res.send({message: 'Hello World'});
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});