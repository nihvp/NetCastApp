const express = require('express');
const dgram = require('dgram');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// UDP Discovery Endpoint
app.get('/api/discover', (req, res) => {
  const socket = dgram.createSocket('udp4');
  let found = false;

  socket.bind(0, () => {
    const message = Buffer.from(
      'M-SEARCH * HTTP/1.1\r\n' +
      'HOST: 239.255.255.250:1900\r\n' +
      'MAN: "ssdp:discover"\r\n' +
      'MX: 3\r\n' +
      'ST: urn:schemas-upnp-org:device:MediaRenderer:1\r\n\r\n'
    );

    socket.send(message, 0, message.length, 1900, '239.255.255.250', (err) => {
      if (err) {
        if (!found) {
          found = true;
          res.status(500).json({ error: 'Failed to send discovery packet.' });
          try { socket.close(); } catch (e) {}
        }
      }
    });
  });

  socket.on('message', (msg, rinfo) => {
    const response = msg.toString();
    if (response.includes('LG') || response.includes('NetCast')) {
      if (!found) {
        found = true;
        res.json({ ip: rinfo.address });
        try { socket.close(); } catch (e) {}
      }
    }
  });

  setTimeout(() => {
    if (!found) {
      found = true;
      res.status(404).json({ error: 'No TV found.' });
      try { socket.close(); } catch (e) {}
    }
  }, 5000);
});

// Proxy POST requests to the TV
app.post('/api/tv', async (req, res) => {
  const { ip, endpoint, xml } = req.body;
  if (!ip || !endpoint || !xml) {
    return res.status(400).json({ error: 'Missing ip, endpoint, or xml payload' });
  }

  try {
    const response = await fetch(`http://${ip}:8080/roap/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/atom+xml' },
      body: xml,
    });
    const text = await response.text();
    res.send(text);
  } catch (error) {
    console.error(`Error communicating with TV at ${ip}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`NetCast Proxy Server running on http://0.0.0.0:${PORT}`);
});
