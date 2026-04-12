import React from "react";
import { Box as InkBox, Text } from "ink";

interface PanelProps {
  title?: string;
  children: React.ReactNode;
  width?: number | string;
  height?: number | string;
  borderColor?: string;
  focused?: boolean;
}

export function Panel({ title, children, width, height, borderColor, focused }: PanelProps): React.ReactElement {
  return (
    <InkBox
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="round"
      borderColor={focused ? "cyan" : borderColor ?? "gray"}
      paddingX={1}
    >
      {title && (
        <Text bold color={focused ? "cyan" : "white"}>
          {title}
        </Text>
      )}
      {children}
    </InkBox>
  );
}
