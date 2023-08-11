import formatDate from "../../format-date";
import {Button, TextField} from "@material-ui/core";
import {changeHandler} from "../../forms";
import {Component, ReactElement} from "react";
import {ContributorLicenseAgreement} from "./contracts";
import ErrorPanel from "../../common/error";
import Loader from "../../common/loader";
import {ApplicationError} from "../../errors";
import {get} from "../../fetch";

export interface ClaSearchState {
  error?: ApplicationError;
  waiting: boolean;
  item: ContributorLicenseAgreement | null | undefined;
  search: string;
  searchError: boolean;
  searchHelperText: string;
}

export class ClaSearch extends Component<{}, ClaSearchState> {
  constructor(props: {}) {
    super(props);

    this.state = {
      error: undefined,
      waiting: false,
      item: undefined,
      search: "",
      searchError: false,
      searchHelperText: "",
    };
  }

  search(): void {
    let {search} = this.state;

    if (!search || !search.trim()) {
      this.setState({
        searchError: true,
        searchHelperText: "Please insert a value",
      });
      return;
    }

    search = search.trim();

    this.setState({
      waiting: true,
      error: undefined,
    });

    get<ContributorLicenseAgreement>(
      `/api/clas/${encodeURIComponent(search)}`
    ).then(
      (data) => {
        this.setState({
          waiting: false,
          item: data,
        });
      },
      (error: ApplicationError) => {
        if (error.status === 404) {
          // Not an error in this case
          this.setState({
            waiting: false,
            item: null,
          });

          return;
        }
        this.setState({
          waiting: false,
          error,
        });
      }
    );
  }

  render(): ReactElement {
    const {error, search, waiting, item} = this.state;

    return (
      <div>
        {waiting && <Loader className="overlay" />}
        <TextField
          value={search}
          name="search"
          error={this.state.searchError}
          helperText={this.state.searchHelperText}
          fullWidth
          label="Search by email"
          autoFocus
          autoComplete="off"
          onChange={changeHandler.bind(this)}
        />
        <div className="buttons-area">
          <Button title="Search CLA" onClick={() => this.search()}>
            Search
          </Button>
        </div>
        {item !== undefined && (
          <div className="region">
            {item === null ? (
              <p>There is no signed CLA for the given email address.</p>
            ) : (
              <div>
                <dl>
                  <dt>Id</dt>
                  <dd>{item.id}</dd>
                  <dt>Email</dt>
                  <dd>{item.email}</dd>
                  <dt>Username</dt>
                  <dd>{item.username}</dd>
                  <dt>Signed at</dt>
                  <dd>{formatDate(item.signedAt)}</dd>
                  <dt>Agreement version</dt>
                  <dd>
                    <a
                      href={`/signed-contributor-license-agreement?version=${item.versionId}`}
                      target="_blank"
                    >
                      {item.versionId}
                    </a>
                  </dd>
                </dl>
              </div>
            )}
          </div>
        )}
        {error && <ErrorPanel error={error} />}
      </div>
    );
  }
}
