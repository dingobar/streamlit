/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { TextArea as TextAreaProto } from "src/autogen/proto"
import { FormClearHelper } from "src/components/widgets/Form"
import { WidgetStateManager, Source } from "src/lib/WidgetStateManager"

import { Textarea as UITextArea } from "baseui/textarea"
import InputInstructions from "src/components/shared/InputInstructions/InputInstructions"
import {
  StyledWidgetLabel,
  StyledWidgetLabelHelp,
} from "src/components/widgets/BaseWidget"
import TooltipIcon from "src/components/shared/TooltipIcon"
import { Placement } from "src/components/shared/Tooltip"
import { isInForm } from "src/lib/utils"

export interface Props {
  disabled: boolean
  element: TextAreaProto
  widgetMgr: WidgetStateManager
  width: number
}

interface State {
  /**
   * True if the user-specified state.value has not yet been synced to the WidgetStateManager.
   */
  dirty: boolean

  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: string
}

class TextArea extends React.PureComponent<Props, State> {
  private readonly formClearHelper = new FormClearHelper()

  public state: State = {
    dirty: false,
    value: this.initialValue,
  }

  get initialValue(): string {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const storedValue = this.props.widgetMgr.getStringValue(this.props.element)
    return storedValue !== undefined ? storedValue : this.props.element.default
  }

  public componentDidMount(): void {
    this.commitWidgetValue({ fromUi: false })
  }

  public componentWillUnmount(): void {
    this.formClearHelper.disconnect()
  }

  /** Commit state.value to the WidgetStateManager. */
  private commitWidgetValue = (source: Source): void => {
    this.props.widgetMgr.setStringValue(
      this.props.element,
      this.state.value,
      source
    )
    this.setState({ dirty: false })
  }

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  private onFormCleared = (): void => {
    this.setState({ value: this.props.element.default }, () =>
      this.commitWidgetValue({ fromUi: true })
    )
  }

  private onBlur = (): void => {
    if (this.state.dirty) {
      this.commitWidgetValue({ fromUi: true })
    }
  }

  private onChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const { value } = e.target
    const { element } = this.props
    const { maxChars } = element

    if (maxChars !== 0 && value.length > maxChars) {
      return
    }

    // If the TextArea is *not* part of a form, we mark it dirty but don't
    // update its value in the WidgetMgr. This means that individual keypresses
    // won't trigger a script re-run.
    if (!isInForm(this.props.element)) {
      this.setState({ dirty: true, value })
      return
    }

    // If TextArea *is* part of a form, we immediately update its widgetValue
    // on text changes. The widgetValue won't be passed to the Python
    // script until the form is submitted, so this won't cause the report
    // to re-run. (This also means that we won't show the "Press Enter
    // to Apply" prompt because the TextArea will never be "dirty").
    this.setState({ dirty: false, value }, () =>
      this.commitWidgetValue({ fromUi: true })
    )
  }

  isEnterKeyPressed = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ): boolean => {
    const { keyCode, key } = event

    // Using keyCode as well due to some different behaviors on Windows
    // https://bugs.chromium.org/p/chromium/issues/detail?id=79407
    return key === "Enter" || keyCode === 13 || keyCode === 10
  }

  private onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const { metaKey, ctrlKey } = e
    const { dirty } = this.state

    if (this.isEnterKeyPressed(e) && (ctrlKey || metaKey) && dirty) {
      e.preventDefault()

      this.commitWidgetValue({ fromUi: true })
    }
  }

  public render = (): React.ReactNode => {
    const { element, disabled, width, widgetMgr } = this.props
    const { value, dirty } = this.state
    const style = { width }
    const { height } = element

    // Manage our form-clear event handler.
    this.formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      this.onFormCleared
    )

    return (
      <div className="stTextArea" style={style}>
        <StyledWidgetLabel>
          {element.label}
          {element.help && (
            <StyledWidgetLabelHelp>
              <TooltipIcon
                content={element.help}
                placement={Placement.TOP_RIGHT}
              />
            </StyledWidgetLabelHelp>
          )}
        </StyledWidgetLabel>
        <UITextArea
          value={value}
          onBlur={this.onBlur}
          onChange={this.onChange}
          onKeyDown={this.onKeyDown}
          disabled={disabled}
          overrides={{
            Input: {
              style: {
                height: height ? `${height}px` : "",
                minHeight: "95px",
                resize: height ? "vertical" : "none",
              },
            },
          }}
        />
        <InputInstructions
          dirty={dirty}
          value={value}
          maxLength={element.maxChars}
          type={"multiline"}
        />
      </div>
    )
  }
}

export default TextArea
