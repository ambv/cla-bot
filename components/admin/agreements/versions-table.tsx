import formatDate from "../../format-date";
import Star from "@material-ui/icons/Star";
import StarBorder from "@material-ui/icons/StarBorder";
import {AgreementVersion} from "./contracts";
import {Component, ReactElement} from "react";

export interface VersionsTableProps {
  items: AgreementVersion[];
  selectedItem?: AgreementVersion;
  onRowClick: (item: AgreementVersion) => void;
}

export class VersionsTable extends Component<VersionsTableProps> {
  constructor(props: VersionsTableProps) {
    super(props);
  }

  renderStatusInformation(isDraft: boolean): ReactElement {
    if (isDraft) {
      return (
        <span
          title="This version is still a draft: its texts can be edited"
          className="help"
        >
          Draft
        </span>
      );
    }

    return (
      <span
        title="The texts of this version are no more editable, but it is
        possible to create a copy in draft status."
        className="help"
      >
        Done
      </span>
    );
  }

  render(): ReactElement {
    const items = this.props.items;

    if (items.length === 0) return <p>There are no configured versions.</p>;

    const selectedItem: AgreementVersion = this.props.selectedItem || items[0];

    return (
      <table>
        <thead>
          <tr>
            <th>Current</th>
            <th>Status</th>
            <th>Id</th>
            <th>Preview</th>
            <th>Created at</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            return (
              <tr
                key={item.id}
                className={item === selectedItem ? "selected-item" : ""}
                onClick={() => this.props.onRowClick(item)}
              >
                <td className="current-version-icon-wrapper">
                  {item.current ? <Star /> : <StarBorder />}
                </td>
                <td>{this.renderStatusInformation(item.draft)}</td>
                <td>{item.id}</td>
                <td>
                  <a
                    href={
                      "/signed-contributor-license-agreement?version=" +
                      item.id
                    }
                    target="_blank"
                  >
                    See preview
                  </a>
                </td>
                <td>{formatDate(item.creationTime)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
}
