/**
 * Projects tab — list of all projects.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SurveyTypeBadge } from '@/components/SurveyTypeBadge';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { useProjectStore } from '@/stores/projectStore';
import type { Project } from '@/types';

export default function ProjectsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const projects = useProjectStore((s) => s.projects);
  const isLoading = useProjectStore((s) => s.isLoading);
  const load = useProjectStore((s) => s.load);

  useEffect(() => {
    load();
  }, []);

  const renderItem = ({ item }: { item: Project }) => (
    <Card style={{ marginBottom: 12 }}>
      <TouchableOpacity
        onPress={() => router.push(`/projects/${item.id}`)}
        style={{ gap: 8 }}
      >
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <SurveyTypeBadge type={item.surveyType} size="sm" />
        </View>
        <View style={styles.metaRow}>
          <MaterialCommunityIcons name="map-marker" size={14} color={'#6B7280'} />
          <Text style={styles.metaText}>
            {item.county ?? '—'}, {item.country}
          </Text>
        </View>
        {item.lrNumber && (
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="file-document-outline" size={14} color={'#6B7280'} />
            <Text style={styles.metaText}>LR {item.lrNumber}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <MaterialCommunityIcons name="account" size={14} color={'#6B7280'} />
          <Text style={styles.metaText}>
            {item.surveyorName} · {item.surveyorLicense}
          </Text>
        </View>
        <View style={styles.footer}>
          <SyncStatusBadge status={item.syncStatus} />
          <Text style={styles.dateText}>
            {new Date(item.updatedAt).toLocaleDateString()}
          </Text>
        </View>
      </TouchableOpacity>
    </Card>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF7F2' }} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('projects.title')}</Text>
          <Text style={styles.subtitle}>{projects.length} projects</Text>
        </View>
        <Button
          title="+ New"
          onPress={() => router.push('/projects/new')}
          size="sm"
        />
      </View>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListEmptyComponent={
          <EmptyState
            icon="folder-open-outline"
            title="No projects yet"
            subtitle={t('projects.empty')}
            action={
              <Button
                title={t('projects.new')}
                onPress={() => router.push('/projects/new')}
              />
            }
          />
        }
        refreshing={isLoading}
        onRefresh={load}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0B1F3A',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0B1F3A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
});
