import { Button } from "@vechaiui/react";
import React from "react";
import { ReactComponent as Keyboard } from "../assets/keyboard.svg";
import { ReactComponent as Menu } from "../assets/menu.svg";
import "./nav.css";

const Nav = () => {
  return (
    <div className="flex items-center w-full px-4 dark h-14 nav">
      {/* <Button
        className="btn btn-md btn-ghost btn-icon "
        color="secondary"
        style={{ width: "40px " }}
      > */}
      <Menu color="white" width="20px" />
      {/* </Button> */}
      <Keyboard width="80px" fill="white" style={{ float: "right" }} />
    </div>
  );
};

export default Nav;
