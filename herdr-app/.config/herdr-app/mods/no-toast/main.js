import { View, div } from "gpui-kit";
import { props, closeOverlay } from "herdr";

export default class NoToast extends View {
  init() {
    const overlay = props()?.overlay;
    if (overlay) closeOverlay(overlay);
  }

  render() {
    return div();
  }
}
