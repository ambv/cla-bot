import {createTheme} from "@material-ui/core/styles";
import red from "@material-ui/core/colors/red";

export default createTheme({
  palette: {
    primary: {
      main: "#175080",
    },
    secondary: {
      main: "#dc004e",
    },
    error: {
      main: red.A400,
    },
    background: {
      default: "#fff",
    },
  },
  props: {
    MuiButton: {
      variant: "outlined",
      color: "primary",
    },
  },
});
