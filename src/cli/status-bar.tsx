import React from 'react';
import { Box, Text } from 'ink';
import { QueueStats } from '../index/indexing-queue';

interface Props {
  stats: QueueStats;
}

export const StatusBar: React.FC<Props> = ({ stats }) => {
  return (
    <Box borderStyle="single" borderColor="grey" paddingX={1} justifyContent="space-between">
      <Text>Queue Status: </Text>
      <Text color="blue">Active: {stats.active}</Text>
      <Text color="green">Done: {stats.processed}</Text>
      <Text color="red">Failed: {stats.failed}</Text>
      <Text>Total: {stats.total}</Text>
    </Box>
  );
};
