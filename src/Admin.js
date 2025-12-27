import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Users, Trophy, Activity, Settings, Target, Clock, TrendingUp, BookOpen, CheckSquare, Award, BarChart } from 'lucide-react';

const supabaseUrl = 'https://uwpjbjejfuocxkapqpti.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cGpiamVqZnVvY3hrYXBxcHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTY5MDAsImV4cCI6MjA4MDQzMjkwMH0.DjatDOhBlDkgfcq7kWQ3wkm-k61TZ_Xqpo9JSCd9tFc';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ADMIN_PWD = "jesuslovesyou";

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, color = 'blue' }) => {
  const colors = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    purple: 'bg-purple-100 text-purple-800',
    red: 'bg-red-100 text-red-800',
    orange: 'bg-orange-100 text-orange-800',
    gray: 'bg-gray-100 text-gray-800'
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
};

// Grit Score 계산 함수
const calculateGritScore = async (userId, allLogs) => {
  if (!userId || !allLogs) return { total: 0, breakdown: null };
  
  try {
    const logs = allLogs.filter(log => log.user_id === userId);
    
    if (logs.length === 0) return { total: 0, breakdown: null };
    
    const studyDates = [...new Set(logs.map(log => 
      new Date(log.created_at).toISOString().split('T')[0]
    ))].sort();
    
    let maxStreak = 0;
    let currentStreak = 1;
    
    for (let i = 1; i < studyDates.length; i++) {
      const prevDate = new Date(studyDates[i-1]);
      const currDate = new Date(studyDates[i]);
      const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentStreak++;
      } else {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 1;
      }
    }
    maxStreak = Math.max(maxStreak, currentStreak);
    
    const streakScore = Math.max(0, maxStreak - 2);
    const streakPercent = Math.min((streakScore / 28) * 30, 30);
    
    const differentProblemsCount = logs.filter(log => 
      log.details?.action === 'different_problems'
    ).length;
    
    const differentPercent = Math.min((differentProblemsCount / 10) * 40, 40);
    
    const startedCount = logs.filter(log => log.details?.status === 'started').length;
    const completedCount = logs.filter(log => log.details?.status === 'completed').length;
    
    const completionRate = startedCount > 0 ? (completedCount / startedCount) : 0;
    const completionPercent = completionRate * 30;
    
    const totalScore = Math.round(streakPercent + differentPercent + completionPercent);
    
    return {
      total: totalScore,
      breakdown: {
        streak: { days: maxStreak, score: Math.round(streakPercent) },
        different: { count: differentProblemsCount, score: Math.round(differentPercent) },
        completion: { rate: Math.round(completionRate * 100), score: Math.round(completionPercent) }
      }
    };
  } catch (error) {
    console.error("Grit score calculation failed:", error);
    return { total: 0, breakdown: null };
  }
};

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(() => {
    const saved = localStorage.getItem('admin_auth');
    if (saved) {
      const { timestamp } = JSON.parse(saved);
      const now = Date.now();
      const hoursPassed = (now - timestamp) / (1000 * 60 * 60);
      if (hoursPassed < 24) {
        return true;
      } else {
        localStorage.removeItem('admin_auth');
      }
    }
    return false;
  });
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalPoints: 0, totalActivities: 0, userList: [] });
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserGritScore, setSelectedUserGritScore] = useState(null);
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedGender, setSelectedGender] = useState('all');

  useEffect(() => {
    if (authenticated) {
      fetchData();
    }
  }, [authenticated]);

  useEffect(() => {
    if (selectedUser && logs.length > 0) {
      calculateGritScore(selectedUser.id, logs).then(score => {
        setSelectedUserGritScore(score);
      });
    }
  }, [selectedUser, logs]);

  const handleAuth = () => {
    if (password === ADMIN_PWD) {
      localStorage.setItem('admin_auth', JSON.stringify({ timestamp: Date.now() }));
      setAuthenticated(true);
    } else {
      alert("Incorrect password");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_auth');
    setAuthenticated(false);
  };

  const fetchData = async () => {
    try {
      const { data: logsData } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false });
      
      const { data: usersData } = await supabase
        .from('users')
        .select('*');

      const userStats = {};
      usersData?.forEach(user => {
        userStats[user.id] = {
          ...user,
          activityCount: 0,
          totalScore: 0
        };
      });

      logsData?.forEach(log => {
        if (userStats[log.user_id]) {
          userStats[log.user_id].activityCount++;
          userStats[log.user_id].totalScore += log.score || 0;
        }
      });

      setLogs(logsData || []);
      
      const totalUsers = usersData?.length || 0;
      const totalPoints = usersData?.reduce((sum, u) => sum + (u.points || 0), 0) || 0;
      const totalActivities = logsData?.length || 0;
      const userList = Object.values(userStats);
      
      setStats({ totalUsers, totalPoints, totalActivities, userList });
    } catch (error) {
      console.error("Admin fetch failed:", error);
    }
  };

  // 필터링된 데이터 가져오기
  const getFilteredData = () => {
    return logs.filter(log => {
      const user = stats.userList.find(u => u.id === log.user_id);
      if (!user) return false;
      
      if (selectedGrade !== 'all' && user.grade !== parseInt(selectedGrade)) return false;
      if (selectedGender !== 'all' && user.gender !== selectedGender) return false;
      
      return true;
    });
  };

  // 분석 1: 학습 시간 & 접속 시간대
  const getStudyTimeAnalysis = () => {
    const filtered = getFilteredData();
    const totalDuration = filtered.reduce((sum, log) => sum + (log.duration_seconds || 0), 0);
    
    const hourDistribution = {};
    for (let i = 0; i < 24; i++) hourDistribution[i] = 0;
    
    filtered.forEach(log => {
      const hour = new Date(log.created_at).getHours();
      hourDistribution[hour]++;
    });
    
    const peakHour = Object.entries(hourDistribution).reduce((max, [hour, count]) => 
      count > max.count ? { hour: parseInt(hour), count } : max
    , { hour: 0, count: 0 });
    
    return {
      totalMinutes: Math.round(totalDuration / 60),
      avgMinutesPerSession: filtered.length > 0 ? Math.round(totalDuration / filtered.length / 60) : 0,
      peakHour: peakHour.hour,
      hourDistribution
    };
  };

  // 분석 3: Reading Topic별 정답/오답률
  const getReadingTopicAnalysis = () => {
    const filtered = getFilteredData().filter(log => log.activity_type === 'Reading' && log.details?.questions);
    
    const topicStats = {};
    
    filtered.forEach(log => {
      const topic = log.details?.topic || 'Unknown';
      if (!topicStats[topic]) {
        topicStats[topic] = { correct: 0, total: 0 };
      }
      
      log.details.questions?.forEach(q => {
        topicStats[topic].total++;
        if (q.correct) topicStats[topic].correct++;
      });
    });
    
    return Object.entries(topicStats).map(([topic, stats]) => ({
      topic,
      correctRate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      totalQuestions: stats.total
    })).sort((a, b) => b.correctRate - a.correctRate);
  };

  // 분석 4: Grammar 영역별 정답/오답률
  const getGrammarTopicAnalysis = () => {
    const filtered = getFilteredData().filter(log => log.activity_type === 'Grammar' && log.details?.questions);
    
    const grammarStats = {};
    
    filtered.forEach(log => {
      log.details.questions?.forEach(q => {
        const point = q.grammarPoint || 'Unknown';
        if (!grammarStats[point]) {
          grammarStats[point] = { correct: 0, total: 0 };
        }
        grammarStats[point].total++;
        if (q.correct) grammarStats[point].correct++;
      });
    });
    
    return Object.entries(grammarStats).map(([point, stats]) => ({
      grammarPoint: point,
      correctRate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      totalQuestions: stats.total
    })).sort((a, b) => b.correctRate - a.correctRate);
  };

  // 분석 5: 완료율
  const getCompletionRateAnalysis = () => {
    const filtered = getFilteredData();
    
    const moduleStats = {};
    ['Vocabulary', 'Grammar', 'Writing', 'Reading'].forEach(module => {
      const moduleLogs = filtered.filter(log => log.activity_type === module);
      const started = moduleLogs.filter(log => log.details?.status === 'started').length;
      const completed = moduleLogs.filter(log => log.details?.status === 'completed').length;
      
      moduleStats[module] = {
        started,
        completed,
        rate: started > 0 ? Math.round((completed / started) * 100) : 0
      };
    });
    
    return moduleStats;
  };

  // 분석 6: 분야별 학습 지속 시간
  const getModuleDurationAnalysis = () => {
    const filtered = getFilteredData();
    
    const moduleStats = {};
    ['Vocabulary', 'Grammar', 'Writing', 'Reading'].forEach(module => {
      const moduleLogs = filtered.filter(log => log.activity_type === module);
      const totalSeconds = moduleLogs.reduce((sum, log) => sum + (log.duration_seconds || 0), 0);
      
      moduleStats[module] = {
        totalMinutes: Math.round(totalSeconds / 60),
        avgMinutes: moduleLogs.length > 0 ? Math.round(totalSeconds / moduleLogs.length / 60) : 0,
        attempts: moduleLogs.length
      };
    });
    
    return moduleStats;
  };

  // 분석 7: 선호 Topic vs 실제 정답률
  const getInterestCorrelation = () => {
    const results = [];
    
    stats.userList.forEach(user => {
      if (!user.interests || user.interests.length === 0) return;
      
      const userLogs = logs.filter(log => 
        log.user_id === user.id && 
        log.activity_type === 'Reading' && 
        log.details?.questions
      );
      
      user.interests.forEach(interest => {
        const topicLogs = userLogs.filter(log => 
          log.details?.topic?.toLowerCase().includes(interest.toLowerCase().split(' ')[0])
        );
        
        if (topicLogs.length > 0) {
          let correct = 0, total = 0;
          topicLogs.forEach(log => {
            log.details.questions?.forEach(q => {
              total++;
              if (q.correct) correct++;
            });
          });
          
          results.push({
            user: user.nickname,
            interest,
            correctRate: total > 0 ? Math.round((correct / total) * 100) : 0,
            attempts: topicLogs.length
          });
        }
      });
    });
    
    return results;
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <div className="text-center mb-6">
            <Settings className="mx-auto text-indigo-600 mb-4" size={48} />
            <h2 className="text-2xl font-bold">Admin Access</h2>
          </div>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
            className="w-full p-3 border rounded-lg mb-4 outline-none focus:ring-2 focus:ring-indigo-500" 
            placeholder="Enter admin password"
          />
          <button 
            onClick={handleAuth} 
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Login
          </button>
        </Card>
      </div>
    );
  }

  const studyTimeData = getStudyTimeAnalysis();
  const readingTopicData = getReadingTopicAnalysis();
  const grammarTopicData = getGrammarTopicAnalysis();
  const completionData = getCompletionRateAnalysis();
  const durationData = getModuleDurationAnalysis();
  const interestData = getInterestCorrelation();

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Admin Dashboard</h2>
          <div className="flex gap-4">
            <button 
              onClick={handleLogout} 
              className="text-sm text-red-500 hover:text-red-600 font-medium"
            >
              Logout
            </button>
            <button 
              onClick={() => window.location.href = '/'} 
              className="text-sm text-gray-500 hover:text-indigo-600"
            >
              ← Back to Main
            </button>
          </div>
        </div>

        {/* 필터 */}
        <Card>
          <div className="flex gap-4 items-center">
            <span className="font-medium">Filters:</span>
            <select 
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="all">All Grades</option>
              {[6,7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
            </select>
            <select 
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        </Card>
        
        {/* 기본 통계 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-center gap-3">
                <Users className="text-indigo-600" size={32} />
                <div>
                  <div className="text-sm text-gray-500">Total Users</div>
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <Trophy className="text-yellow-600" size={32} />
                <div>
                  <div className="text-sm text-gray-500">Total Points</div>
                  <div className="text-2xl font-bold">{stats.totalPoints}</div>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <Activity className="text-green-600" size={32} />
                <div>
                  <div className="text-sm text-gray-500">Activities</div>
                  <div className="text-2xl font-bold">{stats.totalActivities}</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* 분석 메뉴 */}
        <Card>
          <h3 className="font-bold text-lg mb-4">Advanced Analytics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button 
              onClick={() => setActiveAnalysis(activeAnalysis === 'time' ? null : 'time')}
              className={`p-4 rounded-lg border-2 transition-all ${activeAnalysis === 'time' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
            >
              <Clock className="mx-auto mb-2 text-indigo-600" size={24} />
              <div className="text-sm font-medium">Study Time Analysis</div>
            </button>
            <button 
              onClick={() => setActiveAnalysis(activeAnalysis === 'reading' ? null : 'reading')}
              className={`p-4 rounded-lg border-2 transition-all ${activeAnalysis === 'reading' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
            >
              <BookOpen className="mx-auto mb-2 text-orange-600" size={24} />
              <div className="text-sm font-medium">Reading Topics</div>
            </button>
            <button 
              onClick={() => setActiveAnalysis(activeAnalysis === 'grammar' ? null : 'grammar')}
              className={`p-4 rounded-lg border-2 transition-all ${activeAnalysis === 'grammar' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
            >
              <CheckSquare className="mx-auto mb-2 text-green-600" size={24} />
              <div className="text-sm font-medium">Grammar Areas</div>
            </button>
            <button 
              onClick={() => setActiveAnalysis(activeAnalysis === 'completion' ? null : 'completion')}
              className={`p-4 rounded-lg border-2 transition-all ${activeAnalysis === 'completion' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
            >
              <Award className="mx-auto mb-2 text-purple-600" size={24} />
              <div className="text-sm font-medium">Completion Rate</div>
            </button>
            <button 
              onClick={() => setActiveAnalysis(activeAnalysis === 'duration' ? null : 'duration')}
              className={`p-4 rounded-lg border-2 transition-all ${activeAnalysis === 'duration' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
            >
              <TrendingUp className="mx-auto mb-2 text-blue-600" size={24} />
              <div className="text-sm font-medium">Module Duration</div>
            </button>
            <button 
              onClick={() => setActiveAnalysis(activeAnalysis === 'interest' ? null : 'interest')}
              className={`p-4 rounded-lg border-2 transition-all ${activeAnalysis === 'interest' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
            >
              <Target className="mx-auto mb-2 text-red-600" size={24} />
              <div className="text-sm font-medium">Interest Correlation</div>
            </button>
          </div>
        </Card>

        {/* 분석 1: 학습 시간 */}
        {activeAnalysis === 'time' && (
          <Card className="border-l-4 border-l-indigo-500">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Clock size={20} /> Study Time & Peak Hours Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-indigo-50 rounded-lg">
                <div className="text-sm text-gray-600">Total Study Time</div>
                <div className="text-2xl font-bold text-indigo-600">{studyTimeData.totalMinutes}m</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600">Avg per Session</div>
                <div className="text-2xl font-bold text-blue-600">{studyTimeData.avgMinutesPerSession}m</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-sm text-gray-600">Peak Hour</div>
                <div className="text-2xl font-bold text-purple-600">{studyTimeData.peakHour}:00</div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3">Hourly Activity Distribution</h4>
              <div className="grid grid-cols-12 gap-1">
                {Object.entries(studyTimeData.hourDistribution).map(([hour, count]) => {
                  const maxCount = Math.max(...Object.values(studyTimeData.hourDistribution));
                  const heightPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div key={hour} className="flex flex-col items-center">
                      <div 
                        className="w-full bg-indigo-500 rounded-t"
                        style={{ height: `${Math.max(heightPercent, 5)}px` }}
                        title={`${hour}:00 - ${count} activities`}
                      ></div>
                      <div className="text-xs text-gray-500 mt-1">{hour}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {/* 분석 3: Reading Topics */}
        {activeAnalysis === 'reading' && (
          <Card className="border-l-4 border-l-orange-500">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <BookOpen size={20} /> Reading Topic Performance
            </h3>
            <div className="space-y-3">
              {readingTopicData.map(topic => (
                <div key={topic.topic} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{topic.topic}</div>
                    <div className="text-xs text-gray-500">{topic.totalQuestions} questions</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${topic.correctRate >= 70 ? 'bg-green-500' : topic.correctRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${topic.correctRate}%` }}
                      ></div>
                    </div>
                    <div className="text-lg font-bold text-gray-700 w-16 text-right">{topic.correctRate}%</div>
                  </div>
                </div>
              ))}
              {readingTopicData.length === 0 && (
                <p className="text-center text-gray-500 py-4">No data available for selected filters</p>
              )}
            </div>
          </Card>
        )}

        {/* 분석 4: Grammar Areas */}
        {activeAnalysis === 'grammar' && (
          <Card className="border-l-4 border-l-green-500">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <CheckSquare size={20} /> Grammar Area Performance
            </h3>
            <div className="space-y-3">
              {grammarTopicData.map(topic => (
                <div key={topic.grammarPoint} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{topic.grammarPoint}</div>
                    <div className="text-xs text-gray-500">{topic.totalQuestions} questions</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${topic.correctRate >= 70 ? 'bg-green-500' : topic.correctRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${topic.correctRate}%` }}
                      ></div>
                    </div>
                    <div className="text-lg font-bold text-gray-700 w-16 text-right">{topic.correctRate}%</div>
                  </div>
                </div>
              ))}
              {grammarTopicData.length === 0 && (
                <p className="text-center text-gray-500 py-4">No data available for selected filters</p>
              )}
            </div>
          </Card>
        )}

        {/* 분석 5: Completion Rate */}
        {activeAnalysis === 'completion' && (
          <Card className="border-l-4 border-l-purple-500">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Award size={20} /> Module Completion Rate
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(completionData).map(([module, stats]) => (
                <div key={module} className="p-4 bg-gray-50 rounded-lg">
                  <div className="font-bold text-gray-800 mb-2">{module}</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Started:</span>
                      <span className="font-medium">{stats.started}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Completed:</span>
                      <span className="font-medium">{stats.completed}</span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Completion Rate:</span>
                        <span className={`font-bold ${stats.rate >= 70 ? 'text-green-600' : stats.rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {stats.rate}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${stats.rate >= 70 ? 'bg-green-500' : stats.rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${stats.rate}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 분석 6: Module Duration */}
        {activeAnalysis === 'duration' && (
          <Card className="border-l-4 border-l-blue-500">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <TrendingUp size={20} /> Study Duration by Module
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(durationData).map(([module, stats]) => (
                <div key={module} className="p-4 bg-gray-50 rounded-lg">
                  <div className="font-bold text-gray-800 mb-3">{module}</div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Time:</span>
                      <span className="font-bold text-blue-600">{stats.totalMinutes}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg per Session:</span>
                      <span className="font-bold text-indigo-600">{stats.avgMinutes}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Attempts:</span>
                      <span className="font-medium text-gray-700">{stats.attempts}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 분석 7: Interest Correlation */}
        {activeAnalysis === 'interest' && (
          <Card className="border-l-4 border-l-red-500">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Target size={20} /> Interest vs Performance Correlation
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Student</th>
                    <th className="p-2 text-left">Interest Topic</th>
                    <th className="p-2 text-left">Attempts</th>
                    <th className="p-2 text-left">Correct Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {interestData.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 font-medium">{item.user}</td>
                      <td className="p-2">{item.interest}</td>
                      <td className="p-2">{item.attempts}</td>
                      <td className="p-2">
                        <span className={`font-bold ${item.correctRate >= 70 ? 'text-green-600' : item.correctRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {item.correctRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {interestData.length === 0 && (
                <p className="text-center text-gray-500 py-4">No correlation data available</p>
              )}
            </div>
          </Card>
        )}

        {/* 기존 모듈 성능 분석 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-bold text-lg mb-4">Module Performance Analysis</h3>
            <div className="space-y-3">
              {['Vocabulary', 'Grammar', 'Writing', 'Reading'].map(module => {
                const moduleLogs = logs.filter(log => log.activity_type === module);
                const avgScore = moduleLogs.length > 0 
                  ? Math.round(moduleLogs.reduce((sum, log) => sum + (log.score || 0), 0) / moduleLogs.length)
                  : 0;
                const totalAttempts = moduleLogs.length;
                
                return (
                  <div key={module} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{module}</div>
                      <div className="text-xs text-gray-500">{totalAttempts} attempts</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-indigo-600">{avgScore}</div>
                      <div className="text-xs text-gray-500">avg score</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <h3 className="font-bold text-lg mb-4">Student Performance Overview</h3>
            <div className="space-y-3">
              {stats.userList?.slice(0, 5).map(user => {
                const avgScore = user.activityCount > 0 
                  ? Math.round(user.totalScore / user.activityCount)
                  : 0;
                
                let performance = 'Needs Improvement';
                let color = 'text-red-600';
                if (avgScore >= 80) {
                  performance = 'Excellent';
                  color = 'text-green-600';
                } else if (avgScore >= 60) {
                  performance = 'Good';
                  color = 'text-blue-600';
                }
                
                return (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{user.nickname}</div>
                      <div className="text-xs text-gray-500">Grade {user.grade}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${color}`}>{performance}</div>
                      <div className="text-xs text-gray-500">{avgScore} avg</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* User Statistics Table */}
        <Card>
          <h3 className="font-bold text-lg mb-4">User Statistics (Click for Details)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Nickname</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Grade</th>
                  <th className="p-2 text-left">School</th>
                  <th className="p-2 text-left">Total Points</th>
                  <th className="p-2 text-left">Activities</th>
                  <th className="p-2 text-left">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {stats.userList?.map((user) => (
                  <tr 
                    key={user.id} 
                    className="border-t hover:bg-indigo-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedUser(user)}
                  >
                    <td className="p-2 font-medium">{user.nickname || 'N/A'}</td>
                    <td className="p-2 text-xs">{user.email || 'N/A'}</td>
                    <td className="p-2">{user.grade || 'N/A'}</td>
                    <td className="p-2 text-xs">{user.school_name || 'N/A'}</td>
                    <td className="p-2 font-bold text-indigo-600">{user.points || 0}</td>
                    <td className="p-2">{user.activityCount}</td>
                    <td className="p-2">{user.activityCount > 0 ? Math.round(user.totalScore / user.activityCount) : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent Activity Logs */}
        <Card>
          <h3 className="font-bold text-lg mb-4">Recent Activity Logs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">User</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-left">Details</th>
                  <th className="p-2 text-left">Score</th>
                  <th className="p-2 text-left">Duration</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 50).map((log) => {
                  const user = stats.userList?.find(u => u.id === log.user_id);
                  return (
                    <tr key={log.id} className="border-t">
                      <td className="p-2 font-medium">{user?.nickname || 'Unknown'}</td>
                      <td className="p-2"><Badge>{log.activity_type}</Badge></td>
                      <td className="p-2">{log.details?.description || 'N/A'}</td>
                      <td className="p-2 font-bold text-indigo-600">{log.score}</td>
                      <td className="p-2">{Math.round(log.duration_seconds)}s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* 사용자 상세 분석 모달 */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full my-8 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Detailed Analysis: {selectedUser.nickname}</h2>
              <button 
                onClick={() => setSelectedUser(null)}
                className="text-gray-500 hover:text-gray-700 text-3xl font-bold leading-none"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600">Grade</div>
                <div className="text-2xl font-bold text-blue-600">{selectedUser.grade}</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600">Total Points</div>
                <div className="text-2xl font-bold text-green-600">{selectedUser.points}</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-sm text-gray-600">Activities</div>
                <div className="text-2xl font-bold text-purple-600">{selectedUser.activityCount}</div>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="text-sm text-gray-600">Avg Score</div>
                <div className="text-2xl font-bold text-orange-600">
                  {selectedUser.activityCount > 0 ? Math.round(selectedUser.totalScore / selectedUser.activityCount) : 0}
                </div>
              </div>
              <div className="p-4 bg-indigo-50 rounded-lg">
                <div className="text-sm text-gray-600 flex items-center gap-1">
                  <Target size={14} />
                  Grit Score
                </div>
                <div className="text-2xl font-bold text-indigo-600">
                  {selectedUserGritScore ? selectedUserGritScore.total : '...'}
                </div>
              </div>
            </div>

            {/* Grit Score 상세 분석 */}
            {selectedUserGritScore && selectedUserGritScore.breakdown && (
              <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <h3 className="font-bold text-lg mb-3 text-indigo-900">Grit Score Breakdown</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-white rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">연속 공부 일수 (30%)</div>
                    <div className="text-xl font-bold text-indigo-600">{selectedUserGritScore.breakdown.streak.days}일</div>
                    <div className="text-sm text-gray-500">{selectedUserGritScore.breakdown.streak.score}점</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Different Problems (40%)</div>
                    <div className="text-xl font-bold text-indigo-600">{selectedUserGritScore.breakdown.different.count}회</div>
                    <div className="text-sm text-gray-500">{selectedUserGritScore.breakdown.different.score}점</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">완료율 (30%)</div>
                    <div className="text-xl font-bold text-indigo-600">{selectedUserGritScore.breakdown.completion.rate}%</div>
                    <div className="text-sm text-gray-500">{selectedUserGritScore.breakdown.completion.score}점</div>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-6">
              <h3 className="font-bold text-lg mb-4">Module Performance</h3>
              <div className="grid grid-cols-2 gap-4">
                {['Vocabulary', 'Grammar', 'Writing', 'Reading'].map(module => {
                  const moduleLogs = logs.filter(log => 
                    log.user_id === selectedUser.id && log.activity_type === module
                  );
                  const avgScore = moduleLogs.length > 0
                    ? Math.round(moduleLogs.reduce((sum, log) => sum + (log.score || 0), 0) / moduleLogs.length)
                    : 0;
                  const totalTime = moduleLogs.reduce((sum, log) => sum + (log.duration_seconds || 0), 0);
                  
                  let bgColor = 'bg-red-50';
                  let borderColor = 'border-red-200';
                  let textColor = 'text-red-600';
                  if (avgScore >= 80) {
                    bgColor = 'bg-green-50';
                    borderColor = 'border-green-200';
                    textColor = 'text-green-600';
                  } else if (avgScore >= 60) {
                    bgColor = 'bg-blue-50';
                    borderColor = 'border-blue-200';
                    textColor = 'text-blue-600';
                  }
                  
                  return (
                    <div key={module} className={`p-4 ${bgColor} rounded-lg border ${borderColor}`}>
                      <div className="font-bold text-gray-800">{module}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Avg Score: <span className={`font-bold ${textColor}`}>{avgScore}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Attempts: {moduleLogs.length}
                      </div>
                      <div className="text-sm text-gray-600">
                        Total Time: {Math.round(totalTime / 60)}m
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">Strengths</h4>
                <ul className="space-y-1 text-sm">
                  {['Vocabulary', 'Grammar', 'Writing', 'Reading'].map(module => {
                    const moduleLogs = logs.filter(log => 
                      log.user_id === selectedUser.id && log.activity_type === module
                    );
                    const avgScore = moduleLogs.length > 0
                      ? Math.round(moduleLogs.reduce((sum, log) => sum + (log.score || 0), 0) / moduleLogs.length)
                      : 0;
                    if (avgScore >= 70 && moduleLogs.length > 0) {
                      return <li key={module} className="text-green-700">✓ {module} ({avgScore} avg)</li>;
                    }
                    return null;
                  }).filter(Boolean)}
                  {['Vocabulary', 'Grammar', 'Writing', 'Reading'].every(module => {
                    const moduleLogs = logs.filter(log => 
                      log.user_id === selectedUser.id && log.activity_type === module
                    );
                    const avgScore = moduleLogs.length > 0
                      ? Math.round(moduleLogs.reduce((sum, log) => sum + (log.score || 0), 0) / moduleLogs.length)
                      : 0;
                    return avgScore < 70 || moduleLogs.length === 0;
                  }) && <li className="text-gray-500">No strong areas yet</li>}
                </ul>
              </div>
              
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 mb-2">Areas for Improvement</h4>
                <ul className="space-y-1 text-sm">
                  {['Vocabulary', 'Grammar', 'Writing', 'Reading'].map(module => {
                    const moduleLogs = logs.filter(log => 
                      log.user_id === selectedUser.id && log.activity_type === module
                    );
                    const avgScore = moduleLogs.length > 0
                      ? Math.round(moduleLogs.reduce((sum, log) => sum + (log.score || 0), 0) / moduleLogs.length)
                      : 0;
                    if (avgScore < 70 && moduleLogs.length > 0) {
                      return <li key={module} className="text-red-700">⚠ {module} ({avgScore} avg)</li>;
                    }
                    if (moduleLogs.length === 0) {
                      return <li key={module} className="text-gray-600">○ {module} (No data)</li>;
                    }
                    return null;
                  }).filter(Boolean)}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}