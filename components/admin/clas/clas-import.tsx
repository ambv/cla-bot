import * as files from "../../common/files";
import AlertPanel, {AlertProps, AlertSeverity} from "../../common/alert";
import ErrorPanel from "../../common/error";
import FileInfo from "../../common/forms/file-info";
import FileInput from "../../common/forms/file-input";
import Loader from "../../common/loader";
import React from "react";
import uniqueId from "lodash/uniqueId";
import {get, post} from "../../fetch";
import {Component, ReactElement} from "react";
import {ParseError, UnsupportedFileType} from "../../common/errors";
import {parseSync as parseCSV} from "../../common/csv";
import FileExamples, {FileExample} from "../../common/forms/file-examples";
import {Button, TextField} from "@material-ui/core";
import {AgreementListItem} from "../agreements/contracts";
import DynamicSelect from "../../common/forms/select-named-dynamic";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import ErrorOutline from "@material-ui/icons/ErrorOutline";
import NotInterestedIcon from "@material-ui/icons/NotInterested";
import Publish from "@material-ui/icons/Publish";
import {ImportOutput, ImportEntryResult} from "./contracts";
import {ApplicationError} from "../../errors";

enum ImportEntryStatus {
  valid = "valid",
  invalid = "invalid",
  success = "success",
  failure = "failure",
}

interface ImportUIEntry {
  id: string;
  email: string;
  emailError: boolean;
  emailHelperText: string;
  username: string;
  usernameError: boolean;
  usernameHelperText: string;
  status: ImportEntryStatus;
  failureError?: string;
}

const Examples: FileExample[] = [
  {
    id: "csv",
    name: "CSV",
    href: "/import-examples/example.csv",
  },
  {
    id: "plain",
    name: "Plain text",
    href: "/import-examples/example.txt",
  },
  {
    id: "json",
    name: "JSON",
    href: "/import-examples/example.json",
  },
];

interface ClasImportState {
  loading: boolean;
  waiting: boolean;
  error?: ApplicationError;
  submitError?: ApplicationError;
  output?: ImportOutput;
  selectedFile: File | null;
  fileProblem?: AlertProps;
  entries: ImportUIEntry[];
  selectedAgreement: AgreementListItem | null;
}

function uniqueEntryId(): string {
  return uniqueId("entry-");
}

export class ClasImport extends Component<{}, ClasImportState> {
  private fileInput: React.RefObject<FileInput>;

  constructor(props: {}) {
    super(props);

    this.state = {
      loading: false,
      error: undefined,
      waiting: false,
      selectedFile: null,
      entries: [],
      selectedAgreement: null,
    };
    this.fileInput = React.createRef();
  }

  private toEntries(array: any[]): ImportUIEntry[] {
    return array.map(this.toEntry);
  }

  private toEntry(item: any): ImportUIEntry {
    return {
      id: uniqueEntryId(),
      email: item.email || item.emailAddress || "",
      username: item.username || "",
      emailError: false,
      emailHelperText: "",
      usernameError: false,
      usernameHelperText: "",
      status: ImportEntryStatus.valid,
    };
  }

  private parseCSV(text: string): any[] {
    try {
      return parseCSV(text);
    } catch (error) {
      throw new ParseError(`${error}`);
    }
  }

  private parseJSON(text: string): any[] {
    try {
      const data = JSON.parse(text);

      if (data instanceof Array) {
        return data;
      }

      if (data.entries) {
        return data.entries;
      }
    } catch (error) {
      throw new ParseError(`${error}`);
    }

    return [];
  }

  private parsePlainText(text: string): any[] {
    try {
      // skip empty lines
      const lines = text.split(/\n/g).filter((value) => !!value);

      return lines.map((line) => {
        const parts = line.split(/\s+/g);

        if (parts.length === 1) {
          return {
            email: parts[0].trim(),
            username: "",
          };
        }

        if (parts.length > 1) {
          return {
            email: parts[0].trim(),
            username: parts[1].trim(),
          };
        }

        return {};
      });
    } catch (error) {
      throw new ParseError(`${error}`);
    }
  }

  async parseFile(file: File): Promise<ImportUIEntry[]> {
    const type = file.type;
    let contents: string;

    // in Windows, csv files have mime ms-excel :)
    if (type.indexOf("ms-excel") > -1) {
      if (file.name.endsWith(".csv")) {
        contents = await files.readFileAsText(file);
        return this.toEntries(this.parseCSV(contents));
      }
    }

    switch (type) {
      case "application/json":
        contents = await files.readFileAsText(file);
        return this.toEntries(this.parseJSON(contents));
      case "text/csv":
        contents = await files.readFileAsText(file);
        return this.toEntries(this.parseCSV(contents));
      case "text/plain":
        // read one email address by line
        contents = await files.readFileAsText(file);
        return this.toEntries(this.parsePlainText(contents));
      default:
        throw new UnsupportedFileType(type);
    }
  }

  async onFileSelect(file: File | null): Promise<void> {
    if (file === null) {
      this.setState({
        fileProblem: undefined,
        entries: [],
      });
      return;
    }

    let entries: ImportUIEntry[];

    try {
      entries = await this.parseFile(file);
    } catch (error) {
      if (error instanceof UnsupportedFileType) {
        this.setState({
          fileProblem: {
            title: "Unsupported file type",
            message:
              "The selected file is not supported. " +
              "Please select a JSON, CSV, or plain text file. " +
              "See example files for reference.",
            severity: AlertSeverity.info,
          },
          entries: [],
        });
        return;
      }

      if (error instanceof ParseError) {
        this.setState({
          fileProblem: {
            title: "Cannot parse the selected file",
            message: `The selected file could not be parsed. Error: ${error}`,
            severity: AlertSeverity.info,
          },
          entries: [],
        });
        return;
      }

      throw error;
    }

    this.validateItems(entries);

    this.setState({
      fileProblem: undefined,
      selectedFile: file,
      output: undefined,
      entries,
    });
  }

  validateItems(entries: ImportUIEntry[]): void {
    for (const entry of entries) {
      this.validateItem(entry);
    }
  }

  validateItem(entry: ImportUIEntry): void {
    if (!entry.username) {
      entry.usernameError = true;
      entry.usernameHelperText = "Missing username";
    }

    if (entry.emailError || entry.usernameError) {
      entry.status = ImportEntryStatus.invalid;
    }
  }

  reset(): void {
    this.fileInput.current?.clearSelection();
    this.setState({
      output: undefined,
    });
  }

  confirm(): void {
    const {selectedAgreement, entries} = this.state;
    const validEntries = entries.filter(
      (item) => !item.emailError && !item.usernameError
    );

    if (selectedAgreement === null || !validEntries.length) {
      return;
    }

    this.setState({
      waiting: true,
      submitError: undefined,
    });

    post<ImportOutput>("/api/clas/import", {
      agreementId: selectedAgreement.id,
      entries: validEntries,
    }).then(
      (output) => {
        this.handleOutput(output);
      },
      (error: ApplicationError) => {
        this.setState({
          waiting: false,
          submitError: error,
        });
      }
    );
  }

  handleOutput(output: ImportOutput): void {
    const entries = this.state.entries;

    for (const result of output.results) {
      const matchingItem = entries.find((item) => item.id === result.entry.id);

      if (!matchingItem) {
        // should never happen; in case ignore
        continue;
      }

      matchingItem.status = result.success
        ? ImportEntryStatus.success
        : ImportEntryStatus.failure;
      matchingItem.failureError = result.error;
    }

    this.setState({
      waiting: false,
      output,
    });
  }

  getAgreements(): Promise<AgreementListItem[]> {
    return get<AgreementListItem[]>("/api/agreements?filter=complete");
  }

  onAgreementSelect(item: AgreementListItem | null): void {
    this.setState({
      selectedAgreement: item,
    });
  }

  onAgreementsLoaded(items: AgreementListItem[]): void {
    if (!items.length) {
      // cannot import because there are no agreements configured in the system
      const error = new ApplicationError(
        "Before importing CLAs, it is necessary to configure " +
          "at least one agreement with a current version.",
        400
      );
      error.title = "Cannot import CLAs";
      this.setState({
        error,
      });
    }
  }

  render(): ReactElement {
    const {error, submitError, waiting, selectedFile, fileProblem, entries} =
      this.state;

    return (
      <div>
        {waiting && <Loader className="overlay" />}
        <dl className="file-selection">
          <dt>Agreement</dt>
          <dd>
            <DynamicSelect<AgreementListItem>
              load={() => this.getAgreements()}
              onSelect={this.onAgreementSelect.bind(this)}
              onLoaded={this.onAgreementsLoaded.bind(this)}
            />
          </dd>
          <dt>Source</dt>
          <dd>
            <FileInput
              name="file-source"
              accept="text/csv; application/json; text/plain"
              onSelect={this.onFileSelect.bind(this)}
              ref={this.fileInput}
            />
            {selectedFile && (
              <FileInfo
                name={selectedFile.name}
                size={selectedFile.size}
                type={selectedFile.type}
                lastModified={selectedFile.lastModified}
              />
            )}
          </dd>
          <dt>Download an example file</dt>
          <dd className="examples-dd">
            <FileExamples items={Examples} />
          </dd>
        </dl>
        {fileProblem && <AlertPanel {...fileProblem} />}
        {entries.length > 0 && (
          <div className="readonly">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Email</th>
                  <th>Username</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>
                      <TextField
                        value={item.email}
                        error={item.emailError}
                        helperText={item.emailHelperText}
                        disabled
                      />
                    </td>
                    <td>
                      <TextField
                        value={item.username}
                        error={item.usernameError}
                        helperText={item.usernameHelperText}
                        disabled
                      />
                    </td>
                    <td>{this.renderEntryStatus(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {this.renderOutput()}
            {!error && (
              <div className="buttons-area">{this.renderButtons()}</div>
            )}
          </div>
        )}
        {error && <ErrorPanel error={error} />}
        {submitError && <ErrorPanel error={submitError} />}
      </div>
    );
  }

  private renderFailedItems(failedItems: ImportEntryResult[]): ReactElement {
    return (
      <table className="failed-items-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Error</th>
          </tr>
        </thead>
        {failedItems.map((item) => (
          <tr>
            <td>{item.entry.email}</td>
            <td>{item.error}</td>
          </tr>
        ))}
      </table>
    );
  }

  renderOutput(): ReactElement {
    const {output} = this.state;

    if (!output) {
      return <React.Fragment></React.Fragment>;
    }

    const allSuccessful = output.results.every((item) => item.success);

    if (allSuccessful) {
      return (
        <AlertPanel
          title="Import complete"
          message="All items were imported successfully."
          severity={AlertSeverity.success}
        />
      );
    }

    const anySucceeded = output.results.some((item) => item.success);
    const failedItems = output.results.filter((item) => !item.success);

    if (anySucceeded) {
      return (
        <div>
          <AlertPanel
            title="Import partially failed"
            message="Some items were not imported."
            severity={AlertSeverity.warning}
          />
          {this.renderFailedItems(failedItems)}
        </div>
      );
    }

    return (
      <div>
        <AlertPanel
          title="Import failed"
          message="None of the items was imported."
          severity={AlertSeverity.error}
        />
        {this.renderFailedItems(failedItems)}
      </div>
    );
  }

  renderButtons(): ReactElement[] {
    const {output} = this.state;
    const buttons: ReactElement[] = [];

    if (output) {
      buttons.push(
        <Button key="reset-button" onClick={() => this.reset()}>
          Reset
        </Button>
      );
    } else {
      buttons.push(
        <Button key="confirm-button" onClick={() => this.confirm()}>
          Confirm
        </Button>
      );
    }

    return buttons;
  }

  renderEntryStatus(item: ImportUIEntry): ReactElement {
    if (item.status === ImportEntryStatus.valid) {
      return <CheckCircleOutlineIcon className="ok" />;
    }

    if (item.status === ImportEntryStatus.failure) {
      return (
        <span title={item.failureError}>
          <ErrorOutline className="ko" />
        </span>
      );
    }

    if (item.status === ImportEntryStatus.success) {
      return (
        <span title="The item was imported successfully">
          <Publish className="super" />
        </span>
      );
    }

    return (
      <span title={"The item contains errors."}>
        <NotInterestedIcon className="ko" />
      </span>
    );
  }
}
