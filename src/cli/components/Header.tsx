import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  title: string;
}

export const Header: React.FC<Props> = ({ title }) => {
  return (
    <Box 
      flexDirection="column" 
      borderStyle="double" 
      borderColor="cyan" 
      padding={1}
      alignItems="center"
    >
      <Text color="cyan" bold>
        🚀 Website Evaluator AI - {title}
      </Text>
      <Text color="gray" dimColor>
        Phase 2: Discovering company websites using Google Custom Search
      </Text>
    </Box>
  );
}; 