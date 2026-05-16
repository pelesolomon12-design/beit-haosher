import { useEffect } from "react";

export default function InventoryLogin() {
  useEffect(() => {
    window.location.replace("/login.html");
  }, []);
  return null;
}
