const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// Usuarios conectados guardados en memoria
const usuarios = new Map();

app.get("/health", (req, res) => {
  res.json({ ok: true, message: "Servidor funcionando" });
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.on("registrarUsuario", (data) => {
    // ACTIVIDAD: agregar un campo de sala
    const sala = data.sala || "general";

    const usuario = {
      id: socket.id,
      nombre: data.nombre || "Anónimo",
      sala
    };

    usuarios.set(socket.id, usuario);

    // ACTIVIDAD: permitir que cada usuario entre a una sala
    socket.join(sala);

    // ACTIVIDAD: mensaje solo para la sala actual
    io.to(sala).emit("mensajeSistema", `${usuario.nombre} entró a la sala ${sala}`);

    io.emit("usuariosActualizados", Array.from(usuarios.values()));
  });

  socket.on("cambiarSala", (nuevaSala) => {
    const usuario = usuarios.get(socket.id);
    if (!usuario) return;

    // PISTA DEL INGENIERO: sacar al usuario de la sala anterior
    socket.leave(usuario.sala);

    const salaAnterior = usuario.sala;
    usuario.sala = nuevaSala;

    // PISTA DEL INGENIERO: entrar a la nueva sala
    socket.join(nuevaSala);

    usuarios.set(socket.id, usuario);

    io.to(salaAnterior).emit("mensajeSistema", `${usuario.nombre} salió de la sala ${salaAnterior}`);
    io.to(nuevaSala).emit("mensajeSistema", `${usuario.nombre} entró a la sala ${nuevaSala}`);

    io.emit("usuariosActualizados", Array.from(usuarios.values()));

    // ACTIVIDAD: mostrar visualmente la sala activa
    socket.emit("salaActualizada", nuevaSala);
  });

  socket.on("mensajeGlobal", (data) => {
    const usuario = usuarios.get(socket.id);
    if (!usuario) return;

    // ACTIVIDAD: los mensajes globales se envían solo a la sala actual
    io.to(usuario.sala).emit("mensajeGlobal", {
      usuario: usuario.nombre,
      sala: usuario.sala,
      mensaje: data.mensaje,
      hora: new Date().toLocaleTimeString()
    });
  });

  socket.on("mensajePrivado", (data) => {
    socket.to(data.destinoId).emit("mensajePrivado", {
      usuario: data.usuario,
      mensaje: data.mensaje,
      hora: new Date().toLocaleTimeString()
    });
  });

  socket.on("disconnect", () => {
    const usuario = usuarios.get(socket.id);
    usuarios.delete(socket.id);

    io.emit("usuariosActualizados", Array.from(usuarios.values()));

    if (usuario) {
      io.to(usuario.sala).emit("mensajeSistema", `${usuario.nombre} se desconectó`);
    }

    console.log("Usuario desconectado:", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});