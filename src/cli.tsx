#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./tui/App.js";

const serverUrl = process.argv[2] || process.env.REVBUDDY_SERVER || "http://localhost:4455";

render(<App serverUrl={serverUrl} />);
