'use client';

/**
 * Business Info Tab Component
 *
 * Gerenciar informacoes do negocio no Google Meu Negocio
 */

import { useState, useEffect } from 'react';
import { useTranslations } from '@/i18n';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Textarea,
  Skeleton,
  Alert,
} from '@/components/ui';
import {
  Clock,
  Phone,
  Globe,
  FileText,
  Save,
  Loader2,
  MapPin,
  Building2,
  CheckCircle,
} from 'lucide-react';
import {
  useBusinessInfo,
  useUpdateBusinessHours,
  useUpdateBusinessDescription,
  useUpdateBusinessPhone,
  useUpdateBusinessWebsite,
} from '@/hooks/use-google-management';
import { BusinessHours } from '@/services/google-management.service';

// ============================================================================
// Types
// ============================================================================

interface BusinessInfo {
  name: string;
  title: string;
  phoneNumbers?: {
    primaryPhone?: string;
    additionalPhones?: string[];
  };
  websiteUri?: string;
  regularHours?: BusinessHours;
  profile?: {
    description?: string;
  };
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
}

// ============================================================================
// Days of Week
// ============================================================================

const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

type DayOfWeek = typeof DAYS_OF_WEEK[number];

// ============================================================================
// Hours Editor
// ============================================================================

function HoursEditor({
  initialHours,
  onSave,
  isSaving,
}: {
  initialHours?: BusinessHours;
  onSave: (hours: BusinessHours) => void;
  isSaving: boolean;
}) {
  const { t } = useTranslations('googleBusiness');
  const [hours, setHours] = useState<BusinessHours>({ periods: [] });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (initialHours) {
      setHours(initialHours);
    }
  }, [initialHours]);

  const getDayTranslation = (day: DayOfWeek) => {
    const dayMap: Record<DayOfWeek, string> = {
      MONDAY: t('businessInfo.days.monday'),
      TUESDAY: t('businessInfo.days.tuesday'),
      WEDNESDAY: t('businessInfo.days.wednesday'),
      THURSDAY: t('businessInfo.days.thursday'),
      FRIDAY: t('businessInfo.days.friday'),
      SATURDAY: t('businessInfo.days.saturday'),
      SUNDAY: t('businessInfo.days.sunday'),
    };
    return dayMap[day];
  };

  const getPeriodForDay = (day: DayOfWeek) => {
    return hours.periods?.find((p) => p.openDay === day);
  };

  const updateDay = (day: DayOfWeek, openTime: string, closeTime: string, isOpen: boolean) => {
    setIsDirty(true);

    if (!isOpen) {
      setHours((prev) => ({
        ...prev,
        periods: prev.periods?.filter((p) => p.openDay !== day) || [],
      }));
      return;
    }

    const [openHours, openMinutes] = openTime.split(':').map(Number);
    const [closeHours, closeMinutes] = closeTime.split(':').map(Number);

    const newPeriod = {
      openDay: day,
      openTime: { hours: openHours, minutes: openMinutes },
      closeDay: day,
      closeTime: { hours: closeHours, minutes: closeMinutes },
    };

    setHours((prev) => {
      const existingIndex = prev.periods?.findIndex((p) => p.openDay === day) ?? -1;
      if (existingIndex >= 0) {
        const newPeriods = [...(prev.periods || [])];
        newPeriods[existingIndex] = newPeriod;
        return { ...prev, periods: newPeriods };
      } else {
        return { ...prev, periods: [...(prev.periods || []), newPeriod] };
      }
    });
  };

  const formatTime = (time?: { hours: number; minutes: number }) => {
    if (!time) return '09:00';
    return `${String(time.hours).padStart(2, '0')}:${String(time.minutes || 0).padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t('businessInfo.hours')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {DAYS_OF_WEEK.map((day) => {
            const period = getPeriodForDay(day);
            const isOpen = !!period;

            return (
              <div key={day} className="flex items-center gap-4">
                <div className="w-28 font-medium text-sm">{getDayTranslation(day)}</div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => {
                      updateDay(day, '09:00', '18:00', e.target.checked);
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-600">{t('businessInfo.open')}</span>
                </label>
                {isOpen && (
                  <>
                    <Input
                      type="time"
                      value={formatTime(period?.openTime)}
                      onChange={(e) => updateDay(day, e.target.value, formatTime(period?.closeTime), true)}
                      className="w-28"
                    />
                    <span className="text-gray-400">-</span>
                    <Input
                      type="time"
                      value={formatTime(period?.closeTime)}
                      onChange={(e) => updateDay(day, formatTime(period?.openTime), e.target.value, true)}
                      className="w-28"
                    />
                  </>
                )}
                {!isOpen && (
                  <span className="text-sm text-gray-400">{t('businessInfo.closed')}</span>
                )}
              </div>
            );
          })}
        </div>

        {isDirty && (
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => {
                onSave(hours);
                setIsDirty(false);
              }}
              loading={isSaving}
              leftIcon={<Save className="h-4 w-4" />}
            >
              {t('businessInfo.saveHours')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Editable Field Card
// ============================================================================

function EditableFieldCard({
  title,
  icon,
  value,
  placeholder,
  onSave,
  isSaving,
  multiline = false,
  type = 'text',
}: {
  title: string;
  icon: React.ReactNode;
  value?: string;
  placeholder: string;
  onSave: (value: string) => void;
  isSaving: boolean;
  multiline?: boolean;
  type?: string;
}) {
  const { t } = useTranslations('googleBusiness');
  const [localValue, setLocalValue] = useState(value || '');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    setIsDirty(newValue !== (value || ''));
  };

  const handleSave = () => {
    onSave(localValue);
    setIsDirty(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {multiline ? (
          <Textarea
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            rows={4}
          />
        ) : (
          <Input
            type={type}
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
          />
        )}

        {isDirty && (
          <div className="mt-3 flex justify-end">
            <Button
              onClick={handleSave}
              loading={isSaving}
              leftIcon={<Save className="h-4 w-4" />}
              size="sm"
            >
              {t('common.save')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BusinessInfoTab() {
  const { t } = useTranslations('googleBusiness');
  const [savedFields, setSavedFields] = useState<string[]>([]);

  const { data: businessInfo, isLoading, refetch } = useBusinessInfo();

  const updateHoursMutation = useUpdateBusinessHours();
  const updateDescriptionMutation = useUpdateBusinessDescription();
  const updatePhoneMutation = useUpdateBusinessPhone();
  const updateWebsiteMutation = useUpdateBusinessWebsite();

  const handleSaveHours = async (hours: BusinessHours) => {
    await updateHoursMutation.mutateAsync(hours);
    setSavedFields((prev) => [...prev, 'hours']);
    setTimeout(() => setSavedFields((prev) => prev.filter((f) => f !== 'hours')), 3000);
    refetch();
  };

  const handleSaveDescription = async (description: string) => {
    await updateDescriptionMutation.mutateAsync(description);
    setSavedFields((prev) => [...prev, 'description']);
    setTimeout(() => setSavedFields((prev) => prev.filter((f) => f !== 'description')), 3000);
    refetch();
  };

  const handleSavePhone = async (phone: string) => {
    await updatePhoneMutation.mutateAsync(phone);
    setSavedFields((prev) => [...prev, 'phone']);
    setTimeout(() => setSavedFields((prev) => prev.filter((f) => f !== 'phone')), 3000);
    refetch();
  };

  const handleSaveWebsite = async (website: string) => {
    await updateWebsiteMutation.mutateAsync(website);
    setSavedFields((prev) => [...prev, 'website']);
    setTimeout(() => setSavedFields((prev) => prev.filter((f) => f !== 'website')), 3000);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  const info = businessInfo as BusinessInfo | undefined;

  return (
    <div className="space-y-6">
      {/* Business Name & Address (Read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t('businessInfo.basicInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">{t('businessInfo.name')}</label>
              <p className="mt-1 text-gray-900">{info?.title || '-'}</p>
            </div>
            {info?.storefrontAddress && (
              <div>
                <label className="text-sm font-medium text-gray-700">{t('businessInfo.address')}</label>
                <p className="mt-1 text-gray-900 flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                  <span>
                    {info.storefrontAddress.addressLines?.join(', ')}
                    {info.storefrontAddress.locality && `, ${info.storefrontAddress.locality}`}
                    {info.storefrontAddress.administrativeArea && ` - ${info.storefrontAddress.administrativeArea}`}
                    {info.storefrontAddress.postalCode && `, ${info.storefrontAddress.postalCode}`}
                  </span>
                </p>
              </div>
            )}
          </div>
          <Alert variant="info" className="mt-4">
            {t('businessInfo.editInGoogle')}
          </Alert>
        </CardContent>
      </Card>

      {/* Success Messages */}
      {savedFields.length > 0 && (
        <Alert variant="success" className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {t('businessInfo.saved')}
        </Alert>
      )}

      {/* Description */}
      <EditableFieldCard
        title={t('businessInfo.description')}
        icon={<FileText className="h-5 w-5" />}
        value={info?.profile?.description}
        placeholder={t('businessInfo.descriptionPlaceholder')}
        onSave={handleSaveDescription}
        isSaving={updateDescriptionMutation.isPending}
        multiline
      />

      {/* Phone */}
      <EditableFieldCard
        title={t('businessInfo.phone')}
        icon={<Phone className="h-5 w-5" />}
        value={info?.phoneNumbers?.primaryPhone}
        placeholder={t('businessInfo.phonePlaceholder')}
        onSave={handleSavePhone}
        isSaving={updatePhoneMutation.isPending}
        type="tel"
      />

      {/* Website */}
      <EditableFieldCard
        title={t('businessInfo.website')}
        icon={<Globe className="h-5 w-5" />}
        value={info?.websiteUri}
        placeholder={t('businessInfo.websitePlaceholder')}
        onSave={handleSaveWebsite}
        isSaving={updateWebsiteMutation.isPending}
        type="url"
      />

      {/* Business Hours */}
      <HoursEditor
        initialHours={info?.regularHours}
        onSave={handleSaveHours}
        isSaving={updateHoursMutation.isPending}
      />
    </div>
  );
}
