// @flow
import { observable } from "mobx";
import { inject, observer } from "mobx-react";
import * as React from "react";
import { withRouter, type RouterHistory } from "react-router-dom";
import UiStore from "stores/UiStore";
import Document from "models/Document";
import Button from "components/Button";
import Flex from "components/Flex";
import HelpText from "components/HelpText";

type Props = {
  history: RouterHistory,
  document: Document,
  ui: UiStore,
  onSubmit: () => void,
};

@observer
class DocumentDeletePermanently extends React.Component<Props> {
  @observable isDeleting: boolean;

  handleSubmit = async (ev: SyntheticEvent<>) => {
    const { document } = this.props;
    ev.preventDefault();
    this.isDeleting = true;

    try {
      await document.permanentlyDelete();

      // only redirect if we're currently viewing the document that's deleted
      if (this.props.ui.activeDocumentId === document.id) {
        this.props.history.push("/trash");
      }
      this.props.onSubmit();
    } catch (err) {
      this.props.ui.showToast(err.message);
    } finally {
      this.isDeleting = false;
    }
  };

  render() {
    const { document } = this.props;

    return (
      <Flex column>
        <form onSubmit={this.handleSubmit}>
          <HelpText>
            Are you sure about that? Deleting the{" "}
            <strong>{document.titleWithDefault}</strong> {document.noun} will
            permanently delete all of its contents. This action is irreversible.
          </HelpText>
          <Button type="submit" danger>
            {this.isDeleting ? "Deleting…" : "I’m sure – Delete"}
          </Button>
        </form>
      </Flex>
    );
  }
}

export default inject("ui")(withRouter(DocumentDeletePermanently));
