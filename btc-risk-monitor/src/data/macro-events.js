const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const CALENDAR_PATH = path.join(__dirname, '..', 'config', 'macro-calendar.json');

function loadCalendar() {
  try {
    const raw = fs.readFileSync(CALENDAR_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.error('Failed to load macro calendar', { error: err.message });
    return { events: [] };
  }
}

function getUpcomingEvents(hoursAhead = 48) {
  const calendar = loadCalendar();
  const now = new Date();
  const cutoff = new Date(now.getTime() + (hoursAhead * 60 * 60 * 1000));

  return calendar.events
    .map(event => {
      const eventDate = new Date(event.date + 'T00:00:00Z');
      const hoursAway = (eventDate.getTime() - now.getTime()) / (60 * 60 * 1000);
      return { ...event, hoursAway: Math.round(hoursAway * 10) / 10 };
    })
    .filter(event => event.hoursAway > -24 && event.hoursAway <= hoursAhead)
    .sort((a, b) => a.hoursAway - b.hoursAway);
}

function getEventsInRange(days = 14) {
  const calendar = loadCalendar();
  const now = new Date();
  const cutoff = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));

  return calendar.events
    .map(event => {
      const eventDate = new Date(event.date + 'T00:00:00Z');
      const hoursAway = (eventDate.getTime() - now.getTime()) / (60 * 60 * 1000);
      const daysAway = Math.round(hoursAway / 24 * 10) / 10;
      return { ...event, hoursAway, daysAway };
    })
    .filter(event => {
      const eventDate = new Date(event.date + 'T00:00:00Z');
      return eventDate >= now && eventDate <= cutoff;
    })
    .sort((a, b) => a.hoursAway - b.hoursAway);
}

function addEvent(event) {
  const calendar = loadCalendar();
  calendar.events.push(event);
  calendar.events.sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(CALENDAR_PATH, JSON.stringify(calendar, null, 2));
  logger.info(`Added macro event: ${event.name} on ${event.date}`);
}

module.exports = { loadCalendar, getUpcomingEvents, getEventsInRange, addEvent };
