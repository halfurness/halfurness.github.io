import { VechaiProvider } from "@vechaiui/react";
import React from "react";
import "./App.css";
import Home from "./components/home";
import Nav from "./components/nav";

const App = () => {
  return (
    <VechaiProvider>
      <Nav />
      <Home />
    </VechaiProvider>
  );
};

export default App;
