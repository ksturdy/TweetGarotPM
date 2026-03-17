import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import opportunitiesService from '../../services/opportunities';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';

interface FollowButtonProps {
  opportunityId: number;
}

const FollowButton: React.FC<FollowButtonProps> = ({ opportunityId }) => {
  const queryClient = useQueryClient();
  const [hovered, setHovered] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['opportunities', opportunityId, 'follow'],
    queryFn: () => opportunitiesService.getFollowStatus(opportunityId),
    staleTime: 30000,
  });

  const following = data?.following ?? false;

  const followMutation = useMutation({
    mutationFn: () => opportunitiesService.follow(opportunityId),
    onSuccess: () => {
      queryClient.setQueryData(['opportunities', opportunityId, 'follow'], { following: true });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () => opportunitiesService.unfollow(opportunityId),
    onSuccess: () => {
      queryClient.setQueryData(['opportunities', opportunityId, 'follow'], { following: false });
    },
  });

  const handleClick = () => {
    if (following) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  };

  if (isLoading) return null;

  const showUnfollow = following && hovered;

  return (
    <button
      className={`follow-btn ${following ? 'following' : ''} ${showUnfollow ? 'unfollow' : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={followMutation.isPending || unfollowMutation.isPending}
      title={following ? 'Unfollow this opportunity' : 'Follow to get notified of changes'}
    >
      {following ? <NotificationsActiveIcon fontSize="small" /> : <NotificationsNoneIcon fontSize="small" />}
      <span className="follow-btn-text">
        {showUnfollow ? 'Unfollow' : following ? 'Following' : 'Follow'}
      </span>
    </button>
  );
};

export default FollowButton;
