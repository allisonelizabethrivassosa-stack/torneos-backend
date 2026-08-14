const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('API de TorneosINSAL funcionando correctamente 🚀');
});

// ==========================================
// ENDPOINTS PARA TORNEOSINSAL (PROYECTO #6)
// ==========================================

// 1. Obtener equipos
app.get('/equipos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM Equipo');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Registrar un equipo y asignarle su fila en la tabla de posiciones
app.post('/equipos', async (req, res) => {
  const { nombre, seccion, capitan } = req.body;
  try {
    const nuevoEquipo = await pool.query(
      'INSERT INTO Equipo (nombre, seccion, capitan) VALUES ($1, $2, $3) RETURNING *',
      [nombre, seccion, capitan]
    );
    
    // Crear registro inicial en la tabla de posiciones
    await pool.query(
      'INSERT INTO Posicion (id_equipo, puntos, ganados, perdidos, empatados) VALUES ($1, 0, 0, 0, 0)',
      [nuevoEquipo.rows[0].id]
    );

    res.status(201).json(nuevoEquipo.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Obtener calendario de partidos
app.get('/partidos', async (req, res) => {
  try {
    const query = `
      SELECT p.id, p.fecha, p.marcador_local, p.marcador_visitante, p.jugado,
             el.nombre AS equipo_local, ev.nombre AS equipo_visitante
      FROM Partido p
      JOIN Equipo el ON p.id_equipo_local = el.id
      JOIN Equipo ev ON p.id_equipo_visitante = ev.id
      ORDER BY p.fecha ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Capturar/Actualizar resultado de un partido
app.put('/partidos/:id/resultado', async (req, res) => {
  const { id } = req.params;
  const { marcador_local, marcador_visitante } = req.body;

  try {
    // Marcar el partido como jugado y guardar goles
    const partidoResult = await pool.query(
      'UPDATE Partido SET marcador_local = $1, marcador_visitante = $2, jugado = TRUE WHERE id = $3 RETURNING *',
      [marcador_local, marcador_visitante, id]
    );

    const partido = partidoResult.rows[0];

    // Lógica para recalcular puntos
    if (marcador_local > marcador_visitante) {
      // Ganó Local (+3 pts local, +0 visitante)
      await pool.query('UPDATE Posicion SET puntos = puntos + 3, ganados = ganados + 1 WHERE id_equipo = $1', [partido.id_equipo_local]);
      await pool.query('UPDATE Posicion SET perdidos = perdidos + 1 WHERE id_equipo = $1', [partido.id_equipo_visitante]);
    } else if (marcador_visitante > marcador_local) {
      // Ganó Visitante (+3 pts visitante, +0 local)
      await pool.query('UPDATE Posicion SET puntos = puntos + 3, ganados = ganados + 1 WHERE id_equipo = $1', [partido.id_equipo_visitante]);
      await pool.query('UPDATE Posicion SET perdidos = perdidos + 1 WHERE id_equipo = $1', [partido.id_equipo_local]);
    } else {
      // Empate (+1 pt a cada uno)
      await pool.query('UPDATE Posicion SET puntos = puntos + 1, empatados = empatados + 1 WHERE id_equipo = $1', [partido.id_equipo_local]);
      await pool.query('UPDATE Posicion SET puntos = puntos + 1, empatados = empatados + 1 WHERE id_equipo = $1', [partido.id_equipo_visitante]);
    }

    res.json({ mensaje: 'Resultado y tabla de posiciones actualizados exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Obtener tabla de posiciones ordenada por puntos
app.get('/posiciones', async (req, res) => {
  try {
    const query = `
      SELECT e.nombre AS equipo, pos.puntos, pos.ganados, pos.empatados, pos.perdidos
      FROM Posicion pos
      JOIN Equipo e ON pos.id_equipo = e.id
      ORDER BY pos.puntos DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});