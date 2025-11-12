import React from "react";
import { useState, useEffect } from "react";
import type { ModalProps } from "@mantine/core";
import {
  Modal,
  Stack,
  Text,
  TextInput,
  ScrollArea,
  Flex,
  Button,
  CloseButton,
} from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import useFile from "../../../store/useFile";
import useJson from "../../../store/useJson";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return obj;
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

interface ListItemProps {
  item: string;
  value: string;
  onChange: (newValue: string) => void;
}

const ListItem = ({ item, value, onChange }: ListItemProps) => {
  return (
    <div>
      <Text fz="xs" fw={500}>
        {item}
      </Text>
      <TextInput value={value} onChange={event => onChange(event.currentTarget.value)}></TextInput>
    </div>
  );
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  // switches between "read" or "write" state to allow for node editing
  const [status, setStatus] = useState("read");
  const nodeDataJSON = normalizeNodeData(nodeData?.text ?? []);
  // stores user input into text fields for node editing
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  // displays entries of JSON as editable fields
  const nodeItems = Object.keys(nodeDataJSON).map(item => (
    <ListItem
      key={item}
      item={item}
      value={editedValues[item]}
      onChange={val => setEditedValues(prev => ({ ...prev, [item]: val }))}
    ></ListItem>
  ));

  // resets edited values when a new entry is selected
  useEffect(() => {
    const nodeDataJSON = normalizeNodeData(nodeData?.text ?? []);
    const init: Record<string, string> = {};
    Object.keys(nodeDataJSON).forEach(k => {
      init[k] = nodeDataJSON[k] == null ? "" : String(nodeDataJSON[k]);
    });
    setEditedValues(init);
    setStatus("read");
  }, [nodeData]);

  // updates the JSON and working file with edited node data
  const handleSave = () => {
    try {
      const rawJsonString = useJson.getState().getJson();
      const rawJsonObject = JSON.parse(rawJsonString);
      const path = nodeData?.path;
      let currObject = rawJsonObject;
      for (let i = 0; i < path.length; i++) {
        currObject = currObject[path[i]];
        console.log("currObject", currObject);
      }
      for (const item in editedValues) {
        currObject[item] = editedValues[item];
      }
      const newJsonString = JSON.stringify(rawJsonObject, null, 2);
      useJson.getState().setJson(newJsonString);
      // Also update editor contents so the TextEditor shows the new JSON immediately
      useFile.getState().setContents({ contents: newJsonString, hasChanges: false });
      setStatus("read");
      setTimeout(() => {
        const nodes = useGraph.getState().nodes;
        const updatedNode = nodes.find(n => JSON.stringify(n.path) === JSON.stringify(path));
        if (updatedNode) {
          useGraph.getState().setSelectedNode(updatedNode);
        }
      }, 50);
    } catch (e) {
      console.log("Error saving values:", e);
    }
  };

  const handleCancel = () => {
    setEditedValues(nodeDataJSON);
    setStatus("read");
  };
  const handleClose = () => {
    setStatus("read");
    onClose();
  };

  return (
    <Modal size="auto" opened={opened} onClose={handleClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Flex justify="space-between">
              {status === "read" ? (
                <Button onClick={() => setStatus("write")}>Edit</Button>
              ) : (
                <>
                  <Button color="green" onClick={handleSave}>
                    Save
                  </Button>
                  <Button color="red" onClick={handleCancel}>
                    Cancel
                  </Button>
                </>
              )}
              <CloseButton onClick={handleClose} />
            </Flex>
          </Flex>
          <ScrollArea.Autosize mah={250} maw={600}>
            {status === "read" ? (
              <CodeHighlight
                code={JSON.stringify(nodeDataJSON, null, 2)}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            ) : (
              <>{nodeItems}</>
            )}
          </ScrollArea.Autosize>
        </Stack>

        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};