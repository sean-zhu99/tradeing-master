<template>
  <el-card class="panel" shadow="never">
    <template #header>交易复盘</template>

    <el-form label-position="top">
      <el-form-item label="复盘标题">
        <el-input placeholder="例如：BTC 回调假突破复盘" />
      </el-form-item>
      <el-form-item label="交易计划与执行">
        <el-input type="textarea" :rows="5" placeholder="记录入场逻辑、风险控制、执行偏差" />
      </el-form-item>
      <el-form-item label="情绪与纪律">
        <el-input type="textarea" :rows="4" placeholder="记录交易时的心理状态和纪律表现" />
      </el-form-item>
      <el-form-item label="复盘标签">
        <el-select multiple placeholder="选择标签" class="full-width">
          <el-option label="突破" value="breakout" />
          <el-option label="回撤" value="pullback" />
          <el-option label="过早入场" value="early-entry" />
          <el-option label="止损纪律" value="stop-loss" />
        </el-select>
      </el-form-item>
      <el-button type="primary">保存复盘</el-button>
    </el-form>
  </el-card>
</template>
