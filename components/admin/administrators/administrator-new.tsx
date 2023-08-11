import {Button, TextField} from "@material-ui/core";
import {Component, ReactElement} from "react";
import ErrorPanel from "../../common/error";
import Loader from "../../common/loader";
import {changeHandler} from "../../forms";
import {post} from "../../fetch";
import {ApplicationError} from "../../errors";

interface NewAdministratorFormProps {
  onNewAdministrator: () => void;
}

interface NewAdministratorFormState {
  error?: ApplicationError;
  submitError?: ApplicationError;
  loading: boolean;
  submitting: boolean;
  email: string;
  emailError: boolean;
  emailHelperText: string;
}

export default class NewAdministratorForm extends Component<
  NewAdministratorFormProps,
  NewAdministratorFormState
> {
  constructor(props: NewAdministratorFormProps) {
    super(props);

    this.state = {
      error: undefined,
      submitError: undefined,
      loading: true,
      submitting: false,
      email: "",
      emailError: false,
      emailHelperText: "",
    };
  }

  validate(): boolean {
    let anyError = false;
    const {email} = this.state;

    if (!email || !email.trim()) {
      this.setState({
        emailError: true,
        emailHelperText: "Please insert a value",
      });
      anyError = true;
    }

    return !anyError;
  }

  submit(): void {
    if (!this.validate()) {
      return;
    }

    this.setState({
      submitting: true,
      error: undefined,
    });

    const {email} = this.state;

    post("/api/administrators", {
      email: email.trim(),
    }).then(
      () => {
        this.setState({
          email: "",
          submitting: false,
        });

        this.props.onNewAdministrator();
      },
      (error: ApplicationError) => {
        if (error.status === 409) {
          this.setState({
            submitting: false,
            emailError: true,
            emailHelperText:
              "There is already an administrator with this email.",
          });
          return;
        }

        this.setState({
          submitting: false,
          submitError: error,
        });
      }
    );
  }

  render(): ReactElement {
    const {email, emailError, emailHelperText, submitting, submitError} =
      this.state;

    return (
      <div>
        {submitting && <Loader className="overlay" />}
        <h1>Add new administrator</h1>
        <TextField
          value={email}
          error={emailError}
          helperText={emailHelperText}
          name="email"
          required
          fullWidth
          label="Email"
          autoFocus
          autoComplete="off"
          onChange={changeHandler.bind(this)}
        />
        <div className="buttons-area">
          <Button key="submit-button" onClick={() => this.submit()}>
            Add
          </Button>
        </div>
        {submitError && <ErrorPanel error={submitError} />}
      </div>
    );
  }
}
