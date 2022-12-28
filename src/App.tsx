import React from "react";
import "./App.css";
import { VechaiProvider } from "@vechaiui/react";
import Home from "./components/home";
import Nav from "./components/nav";

function App() {
  return (
    <VechaiProvider>
      <Nav />
      <Home />
    </VechaiProvider>
  );
}

export default App;
